"use client"

/**
 * app/instructions/instructions-view.client.tsx — 指令表格 + 回填 / 否决 / 跳过
 *
 * 与 P2a 差异：
 *   - date / session 来自 URL searchParams（RSC 传入），切换通过 router.replace 回写 URL
 *   - 所有写操作调真 API；成功后 router.refresh() 让父 RSC 重拉数据
 *   - 提交期间禁用按钮避免重复提交
 */
import { Fragment, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ActionBadge,
  DirectionBadge,
  StatusBadge,
  pnlClass,
} from "@/components/status-badges"
import {
  type Instruction,
  type InstructionSession,
  type TriggerSource,
  TRIGGER_SOURCE_LABELS,
} from "@/lib/types"
import {
  postFill,
  skipInstruction,
  vetoInstruction,
} from "@/lib/api"

type RowDraft = {
  filled_qty: string
  filled_price: string
  trigger_source: TriggerSource
  note: string
}

const EMPTY_DRAFT: RowDraft = {
  filled_qty: "",
  filled_price: "",
  trigger_source: "user_manual",
  note: "",
}

export function InstructionsView({
  instructions,
  date,
  session,
}: {
  instructions: Instruction[]
  date: string
  session: InstructionSession
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [submittingId, setSubmittingId] = useState<string | null>(null)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({})
  const [vetoTarget, setVetoTarget] = useState<string | null>(null)
  const [vetoReason, setVetoReason] = useState("")
  const [vetoErr, setVetoErr] = useState(false)

  const rows = instructions
  const pendingCount = rows.filter(
    (r) => r.status === "pending" || r.status === "partially_filled",
  ).length

  const getDraft = (id: string): RowDraft => drafts[id] ?? EMPTY_DRAFT
  const setDraft = (id: string, patch: Partial<RowDraft>) =>
    setDrafts((s) => ({ ...s, [id]: { ...getDraft(id), ...patch } }))

  /** URL 回写：切 date/session 触发 RSC 重新拉数据。 */
  const updateUrl = (next: { date?: string; session?: string }) => {
    const q = new URLSearchParams({
      date: next.date ?? date,
      session: next.session ?? session,
    })
    router.replace(`/instructions?${q.toString()}`)
  }

  // ---------- 回填 ----------
  const handleRowSubmit = (id: string) => {
    const d = getDraft(id)
    const qty = Number(d.filled_qty)
    const price = Number(d.filled_price)
    if (!(qty > 0 && price > 0)) {
      toast.error("请填写有效的成交量和成交价")
      return
    }
    setSubmittingId(id)
    startTransition(async () => {
      try {
        await postFill({
          instruction_id: id,
          filled_qty: qty,
          filled_price: price,
          filled_at: new Date().toISOString(),
          trigger_source: d.trigger_source,
          note: d.note.trim() || null,
        })
        toast.success(`已回填：${qty} 手 @ ${price}`, {
          description: `触发源：${TRIGGER_SOURCE_LABELS[d.trigger_source]}`,
        })
        setExpandedId(null)
        setDrafts((s) => {
          const n = { ...s }
          delete n[id]
          return n
        })
        router.refresh()
      } catch (err) {
        toast.error("回填失败", {
          description: err instanceof Error ? err.message : String(err),
        })
      } finally {
        setSubmittingId(null)
      }
    })
  }

  // ---------- 跳过 ----------
  const handleSkip = (id: string) => {
    setSubmittingId(id)
    startTransition(async () => {
      try {
        await skipInstruction(id)
        toast.message("已标记跳过", {
          description: `指令 ${id.slice(0, 14)}… 不再追踪`,
        })
        setExpandedId(null)
        router.refresh()
      } catch (err) {
        toast.error("跳过失败", {
          description: err instanceof Error ? err.message : String(err),
        })
      } finally {
        setSubmittingId(null)
      }
    })
  }

  // ---------- 否决 ----------
  const handleVetoSubmit = () => {
    if (!vetoReason.trim()) {
      setVetoErr(true)
      return
    }
    const id = vetoTarget
    if (!id) return
    setSubmittingId(id)
    startTransition(async () => {
      try {
        await vetoInstruction(id, vetoReason.trim())
        toast.error(`已否决：${vetoReason.slice(0, 30)}`, {
          description: "原因已写入审计日志",
        })
        setVetoTarget(null)
        setVetoReason("")
        setVetoErr(false)
        setExpandedId(null)
        router.refresh()
      } catch (err) {
        toast.error("否决失败", {
          description: err instanceof Error ? err.message : String(err),
        })
      } finally {
        setSubmittingId(null)
      }
    })
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">今日指令</h1>
          <p className="text-sm text-muted-foreground mt-1">
            回填实际成交 · 否决 · 跳过 — 每条指令必须闭环
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>筛选</CardTitle>
          <CardDescription>选择业务日期和交易时段</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="grid gap-1.5">
              <Label>业务日期</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => updateUrl({ date: e.target.value })}
                className="w-44"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>交易时段</Label>
              <RadioGroup
                className="flex gap-4"
                value={session}
                onValueChange={(v) =>
                  updateUrl({ session: (v as InstructionSession) ?? "day" })
                }
              >
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <RadioGroupItem value="day" /> 日盘
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <RadioGroupItem value="night" /> 夜盘
                </label>
              </RadioGroup>
            </div>
            <div className="ml-auto flex gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">共 {rows.length} 条</Badge>
              <Badge className="bg-red-600 text-white">
                待处理 {pendingCount}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>指令列表</CardTitle>
          <CardDescription>
            点击右侧"展开"进入回填 / 否决 / 跳过操作
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">品种</TableHead>
                <TableHead>合约</TableHead>
                <TableHead>动作</TableHead>
                <TableHead>方向</TableHead>
                <TableHead className="text-right">目标手数</TableHead>
                <TableHead className="text-right">参考入场</TableHead>
                <TableHead className="text-right">参考止损</TableHead>
                <TableHead className="text-right">已成交</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="pr-4 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="text-center text-muted-foreground py-10"
                  >
                    该日期 / 时段没有指令
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => {
                const isExpanded = expandedId === r.id
                const locked =
                  r.status === "fully_filled" ||
                  r.status === "vetoed" ||
                  r.status === "skipped" ||
                  r.status === "expired"
                const remaining = r.target_qty - (r.filled_qty_total ?? 0)
                const isRowSubmitting = submittingId === r.id && isPending

                return (
                  <Fragment key={r.id}>
                    <TableRow
                      aria-expanded={isExpanded}
                      className="align-middle"
                    >
                      <TableCell className="pl-4 font-medium">
                        {r.symbol}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.contract_code}
                      </TableCell>
                      <TableCell>
                        <ActionBadge action={r.action} />
                      </TableCell>
                      <TableCell>
                        <DirectionBadge direction={r.direction} />
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {r.target_qty}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {r.entry_price_ref ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {r.stop_loss_ref ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {r.filled_qty_total ?? 0} / {r.target_qty}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        {locked ? (
                          <span className="text-xs text-muted-foreground">
                            已结束
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant={isExpanded ? "secondary" : "outline"}
                            onClick={() =>
                              setExpandedId(isExpanded ? null : r.id)
                            }
                          >
                            {isExpanded ? "收起" : "展开"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    {isExpanded && !locked && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={10} className="bg-muted/30 p-4">
                          <InstructionForm
                            draft={getDraft(r.id)}
                            maxQty={remaining}
                            refPrice={
                              r.entry_price_ref !== null
                                ? Number(r.entry_price_ref)
                                : null
                            }
                            disabled={isRowSubmitting}
                            onChange={(patch) => setDraft(r.id, patch)}
                            onSubmit={() => handleRowSubmit(r.id)}
                            onVeto={() => {
                              setVetoTarget(r.id)
                              setVetoReason("")
                              setVetoErr(false)
                            }}
                            onSkip={() => handleSkip(r.id)}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 否决 Dialog */}
      <Dialog
        open={vetoTarget !== null}
        onOpenChange={(o) => {
          if (!o) {
            setVetoTarget(null)
            setVetoReason("")
            setVetoErr(false)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>否决指令</DialogTitle>
            <DialogDescription>
              否决原因将写入 audit log · 审计不可变，请填写清楚
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label>否决原因</Label>
            <Textarea
              placeholder="示例：盘前公告突发，价格跳空，暂不建仓"
              value={vetoReason}
              onChange={(e) => {
                setVetoReason(e.target.value)
                if (e.target.value.trim()) setVetoErr(false)
              }}
              aria-invalid={vetoErr}
              className="min-h-24"
            />
            {vetoErr && (
              <p className="text-xs text-red-600">否决原因不能为空</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVetoTarget(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleVetoSubmit}
              disabled={isPending}
            >
              确认否决
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** 回填表单（展开行内）。 */
function InstructionForm({
  draft,
  maxQty,
  refPrice,
  disabled,
  onChange,
  onSubmit,
  onVeto,
  onSkip,
}: {
  draft: RowDraft
  maxQty: number
  refPrice: number | null
  disabled: boolean
  onChange: (p: Partial<RowDraft>) => void
  onSubmit: () => void
  onVeto: () => void
  onSkip: () => void
}) {
  const filledEst = Number(draft.filled_qty) * Number(draft.filled_price)
  const refCost = refPrice ? Number(draft.filled_qty) * refPrice : 0
  const slip = refCost > 0 ? filledEst - refCost : 0

  return (
    <div className="grid gap-4 md:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
      <div className="grid gap-1.5">
        <Label>成交量 (手)</Label>
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          max={maxQty}
          placeholder={`剩余 ${maxQty}`}
          value={draft.filled_qty}
          onChange={(e) => onChange({ filled_qty: e.target.value })}
          disabled={disabled}
        />
      </div>
      <div className="grid gap-1.5">
        <Label>成交价</Label>
        <Input
          type="number"
          step="0.01"
          placeholder={refPrice ? String(refPrice) : "价格"}
          value={draft.filled_price}
          onChange={(e) => onChange({ filled_price: e.target.value })}
          disabled={disabled}
        />
      </div>
      <div className="grid gap-1.5">
        <Label>触发源</Label>
        <RadioGroup
          className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:gap-3"
          value={draft.trigger_source}
          onValueChange={(v) =>
            onChange({ trigger_source: (v as TriggerSource) ?? "user_manual" })
          }
        >
          {(
            Object.entries(TRIGGER_SOURCE_LABELS) as [TriggerSource, string][]
          ).map(([k, label]) => (
            <label
              key={k}
              className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap"
            >
              <RadioGroupItem value={k} /> {label}
            </label>
          ))}
        </RadioGroup>
      </div>
      <div className="flex flex-col gap-2 min-w-40">
        <Button onClick={onSubmit} disabled={disabled}>
          {disabled ? "提交中…" : "成交回填"}
        </Button>
        <div className="flex gap-2">
          <Button
            variant="destructive"
            className="flex-1"
            onClick={onVeto}
            disabled={disabled}
          >
            否决
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={onSkip}
            disabled={disabled}
          >
            跳过
          </Button>
        </div>
      </div>
      <div className="md:col-span-4 grid gap-1.5">
        <Label>备注（可选）</Label>
        <Textarea
          placeholder="记录成交细节 / 盘中观察，可选"
          value={draft.note}
          onChange={(e) => onChange({ note: e.target.value })}
          className="min-h-16"
          disabled={disabled}
        />
      </div>
      {refPrice && Number(draft.filled_qty) > 0 && Number(draft.filled_price) > 0 && (
        <div className="md:col-span-4">
          <Separator className="my-2" />
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span>
              估算成交金额：
              <span className="font-mono ml-1 text-foreground">
                {filledEst.toLocaleString("zh-CN", {
                  maximumFractionDigits: 0,
                })}
              </span>
            </span>
            <span>
              相对参考滑点：
              <span className={`font-mono ml-1 ${pnlClass(slip)}`}>
                {slip > 0 ? "+" : ""}
                {slip.toLocaleString("zh-CN", {
                  maximumFractionDigits: 0,
                })}
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
