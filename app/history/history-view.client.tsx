"use client"

/**
 * app/history/history-view.client.tsx — 历史查询展示。
 *
 * 本次只展示单日指令（后端 API 限制）；URL searchParams 控制日期。
 * Filter chips（action / status / symbol）在客户端本地筛选。
 * fills 明细展示：直接读 instruction.filled_qty_total / avg_filled_price（view 聚合字段），
 * 若后端未来扩展单笔 fills 明细，可再增 `/api/instructions/{id}/fills` 端点。
 */
import { Fragment, useState } from "react"
import { useRouter } from "next/navigation"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  ActionBadge,
  DirectionBadge,
  StatusBadge,
} from "@/components/status-badges"
import {
  type Instruction,
  type InstructionAction,
  type InstructionStatus,
  STATUS_LABELS,
  ACTION_LABELS,
} from "@/lib/types"

export function HistoryView({
  instructions,
  date,
}: {
  instructions: Instruction[]
  date: string
}) {
  const router = useRouter()

  const [actionFilter, setActionFilter] = useState<InstructionAction | null>(
    null,
  )
  const [statusFilter, setStatusFilter] = useState<InstructionStatus | null>(
    null,
  )
  const [symbolFilter, setSymbolFilter] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const allSymbols = Array.from(
    new Set(instructions.map((r) => r.symbol)),
  ).sort()

  const filtered = instructions.filter((r) => {
    if (actionFilter && r.action !== actionFilter) return false
    if (statusFilter && r.status !== statusFilter) return false
    if (symbolFilter && r.symbol !== symbolFilter) return false
    return true
  })

  const updateDate = (d: string) => {
    const q = new URLSearchParams({ date: d })
    router.replace(`/history?${q.toString()}`)
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">历史查询</h1>
        <p className="text-sm text-muted-foreground mt-1">
          按日期检索历史指令 · 展开查看该指令下的成交明细
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>筛选条件</CardTitle>
          <CardDescription>
            点击 chip 快速过滤；再次点击取消
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="grid gap-1.5">
              <Label>业务日期</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => updateDate(e.target.value)}
                className="w-44"
              />
            </div>
            <div className="ml-auto text-xs text-muted-foreground">
              命中 <span className="font-mono text-foreground">{filtered.length}</span> 条
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground mr-1">动作</span>
              {(Object.keys(ACTION_LABELS) as InstructionAction[]).map((k) => (
                <FilterChip
                  key={k}
                  active={actionFilter === k}
                  onClick={() =>
                    setActionFilter(actionFilter === k ? null : k)
                  }
                >
                  {ACTION_LABELS[k]}
                </FilterChip>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground mr-1">状态</span>
              {(Object.keys(STATUS_LABELS) as InstructionStatus[]).map((k) => (
                <FilterChip
                  key={k}
                  active={statusFilter === k}
                  onClick={() =>
                    setStatusFilter(statusFilter === k ? null : k)
                  }
                >
                  {STATUS_LABELS[k]}
                </FilterChip>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground mr-1">品种</span>
              {allSymbols.map((s) => (
                <FilterChip
                  key={s}
                  active={symbolFilter === s}
                  onClick={() =>
                    setSymbolFilter(symbolFilter === s ? null : s)
                  }
                >
                  {s}
                </FilterChip>
              ))}
            </div>
            {(actionFilter || statusFilter || symbolFilter) && (
              <div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setActionFilter(null)
                    setStatusFilter(null)
                    setSymbolFilter(null)
                  }}
                >
                  清除所有过滤器
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>指令 + 成交汇总</CardTitle>
          <CardDescription>
            展开查看该指令聚合的平均成交价 / 否决原因
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">日期</TableHead>
                <TableHead>品种</TableHead>
                <TableHead>合约</TableHead>
                <TableHead>动作</TableHead>
                <TableHead>方向</TableHead>
                <TableHead className="text-right">目标</TableHead>
                <TableHead className="text-right">已成交</TableHead>
                <TableHead className="text-right">均价</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="pr-4 text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="text-center text-muted-foreground py-10"
                  >
                    没有匹配的历史指令
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((r) => {
                const isOpen = expandedId === r.id
                return (
                  <Fragment key={r.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() =>
                        setExpandedId(isOpen ? null : r.id)
                      }
                      aria-expanded={isOpen}
                    >
                      <TableCell className="pl-4 font-mono text-xs">
                        {r.session_date}
                      </TableCell>
                      <TableCell className="font-medium">{r.symbol}</TableCell>
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
                      <TableCell className="text-right font-mono">
                        {r.filled_qty_total ?? 0}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {r.avg_filled_price ?? "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="pr-4 text-right text-xs text-muted-foreground">
                        {isOpen ? "收起 ▲" : "展开 ▼"}
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={10} className="bg-muted/30 p-4">
                          {r.status === "vetoed" ? (
                            <div className="text-sm">
                              <span className="text-muted-foreground">
                                否决原因：
                              </span>
                              <span>{r.veto_reason ?? "—"}</span>
                            </div>
                          ) : (
                            <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-sm">
                              <div>
                                <dt className="text-xs text-muted-foreground">
                                  指令 ID
                                </dt>
                                <dd className="font-mono text-xs">{r.id}</dd>
                              </div>
                              <div>
                                <dt className="text-xs text-muted-foreground">
                                  生成时间
                                </dt>
                                <dd className="font-mono text-xs">
                                  {r.generated_at}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-xs text-muted-foreground">
                                  参考入场
                                </dt>
                                <dd className="font-mono">
                                  {r.entry_price_ref ?? "—"}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-xs text-muted-foreground">
                                  参考止损
                                </dt>
                                <dd className="font-mono">
                                  {r.stop_loss_ref ?? "—"}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-xs text-muted-foreground">
                                  已成交 / 目标
                                </dt>
                                <dd className="font-mono">
                                  {r.filled_qty_total ?? 0} / {r.target_qty}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-xs text-muted-foreground">
                                  平均成交价
                                </dt>
                                <dd className="font-mono">
                                  {r.avg_filled_price ?? "—"}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-xs text-muted-foreground">
                                  止损单号
                                </dt>
                                <dd className="font-mono text-xs">
                                  {r.broker_stop_order_id ?? "—"}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-xs text-muted-foreground">
                                  更新时间
                                </dt>
                                <dd className="font-mono text-xs">
                                  {r.updated_at}
                                </dd>
                              </div>
                            </dl>
                          )}
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
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-full border border-transparent bg-primary text-primary-foreground px-2.5 py-0.5 text-xs font-medium transition-colors"
          : "rounded-full border border-border bg-transparent text-foreground/70 hover:bg-muted px-2.5 py-0.5 text-xs transition-colors"
      }
    >
      {children}
    </button>
  )
}
