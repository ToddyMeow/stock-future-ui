"use client"

/**
 * app/positions/positions-view.client.tsx — 当前持仓纯展示。
 *
 * 后端 /api/positions 已返回 enriched 字段（last_price = 最近一日 bars.settle，
 * contract_multiplier = bars 乘数，unrealized_pnl / notional_mv 均后端派生）。
 * 若后端某字段缺失（bars 表无数据 fallback），前端做兜底：
 *   - last_price   -> avg_entry_price
 *   - unrealized_pnl -> 0
 *   - contract_multiplier -> 10（兜底常量，正常不该走到）
 */
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DirectionBadge, pnlClass } from "@/components/status-badges"
import {
  formatCurrency,
  formatDate,
} from "@/lib/mock"
import { postRollConfirm } from "@/lib/api"
import type { DailyPnl, Position, RollCandidate } from "@/lib/types"

/** 换约对话框的表单状态（受控 input，字符串便于用户清空）。 */
type RollDraft = {
  old_close_price: string
  new_open_price: string
  note: string
}

export function PositionsView({
  positions,
  pnl,
  rolls = [],
}: {
  positions: Position[]
  pnl: DailyPnl[]
  rolls?: RollCandidate[]
}) {
  const router = useRouter()
  // 按 (symbol, current_contract) 索引换约候选，每行查询 O(1)
  const rollMap = new Map<string, RollCandidate>()
  for (const r of rolls) {
    rollMap.set(`${r.symbol}|${r.current_contract}`, r)
  }
  const latest = pnl[pnl.length - 1]
  const latestEquity = latest?.equity ?? 0

  // ---------- 换约对话框状态 ----------
  // 持 { candidate, position } —— 打开时填入，关闭时 null
  const [rollTarget, setRollTarget] = useState<{
    candidate: RollCandidate
    position: Position
  } | null>(null)
  const [rollDraft, setRollDraft] = useState<RollDraft>({
    old_close_price: "",
    new_open_price: "",
    note: "",
  })
  const [isRollSubmitting, startRollTransition] = useTransition()

  const openRollDialog = (candidate: RollCandidate, position: Position) => {
    setRollTarget({ candidate, position })
    setRollDraft({
      // 默认值取 candidate 的最新结算价（字符串 / 数字都可，Number() 转）
      old_close_price:
        candidate.current_last_price != null
          ? String(candidate.current_last_price)
          : "",
      new_open_price:
        candidate.new_last_price != null
          ? String(candidate.new_last_price)
          : "",
      note: "",
    })
  }
  const closeRollDialog = () => setRollTarget(null)

  const handleRollSubmit = () => {
    if (!rollTarget) return
    const { candidate, position } = rollTarget
    const oldPrice = Number(rollDraft.old_close_price)
    const newPrice = Number(rollDraft.new_open_price)
    if (!(oldPrice > 0 && newPrice > 0)) {
      toast.error("请填写有效的旧合约平仓均价和新合约开仓均价")
      return
    }
    startRollTransition(async () => {
      try {
        const resp = await postRollConfirm({
          symbol: candidate.symbol,
          old_contract: candidate.current_contract,
          new_contract: candidate.new_dominant_contract,
          old_close_price: oldPrice,
          new_open_price: newPrice,
          note: rollDraft.note.trim() || undefined,
        })
        toast.success(
          `换约完成 ${resp.old_contract} → ${resp.new_contract} ${Math.abs(resp.qty)} 手`,
          {
            description: `新持仓均价 ${Number(resp.new_open_price).toLocaleString("zh-CN")}`,
          },
        )
        closeRollDialog()
        router.refresh()
      } catch (err) {
        toast.error("换约失败", {
          description: err instanceof Error ? err.message : String(err),
        })
        // 失败保留对话框，让用户看到错误并修正（不 close）
      }
    })
    void position // 保持引用避免 lint 警告（position 仅用作 display 上下文）
  }

  // 单条持仓名义价值：优先用后端 notional_mv；否则
  // |qty| * (last_price ?? avg_entry) * (contract_multiplier ?? 10)
  // 后端 Decimal 序列化为字符串，统一 Number() 强转。
  const notionalOf = (p: Position) => {
    if (p.notional_mv != null) return Number(p.notional_mv)
    const last = Number(p.last_price ?? p.avg_entry_price)
    const mult = Number(p.contract_multiplier ?? 10)
    return Math.abs(p.qty) * last * mult
  }

  const totalNotional = positions.reduce((acc, p) => acc + notionalOf(p), 0)
  // 注意：后端 Decimal 序列化为字符串，需 Number() 强转避免字符串拼接
  const totalUnrealized = positions.reduce(
    (acc, p) => acc + Number(p.unrealized_pnl ?? 0),
    0,
  )

  // 按组聚合暴露
  const groupExposure = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of positions) {
      map.set(p.group_name, (map.get(p.group_name) ?? 0) + notionalOf(p))
    }
    return Array.from(map.entries())
      .map(([group, notional]) => ({ group, notional }))
      .sort((a, b) => b.notional - a.notional)
  }, [positions])

  const groupColors = ["#16a34a", "#2563eb", "#ea580c", "#7c3aed", "#0891b2"]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">当前持仓</h1>
        <p className="text-sm text-muted-foreground mt-1">
          实时活跃持仓快照 · 组级暴露度
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardDescription>账户权益</CardDescription>
            <CardTitle className="text-2xl font-bold">
              {formatCurrency(latestEquity)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              现金 {formatCurrency(latest?.cash ?? 0)} · 持仓市值{" "}
              {formatCurrency(latest?.open_positions_mv ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>持仓合约名义价值</CardDescription>
            <CardTitle className="text-2xl font-bold">
              {formatCurrency(totalNotional)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              共 {positions.length} 个合约 · 杠杆约{" "}
              {latestEquity > 0
                ? (totalNotional / latestEquity).toFixed(2)
                : "—"}
              ×
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>当前浮动盈亏</CardDescription>
            <CardTitle
              className={`text-2xl font-bold ${pnlClass(totalUnrealized)}`}
            >
              {formatCurrency(totalUnrealized, true)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              相对平均开仓价的未实现盈亏
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>持仓明细</CardTitle>
          <CardDescription>
            正数手数为多头、负数为空头；止损价来自最新止损调整
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">品种</TableHead>
                <TableHead>合约</TableHead>
                <TableHead>方向</TableHead>
                <TableHead className="text-right">手数</TableHead>
                <TableHead className="text-right">均价</TableHead>
                <TableHead className="text-right">最新结算价</TableHead>
                <TableHead className="text-right">止损价</TableHead>
                <TableHead>策略组</TableHead>
                <TableHead>开仓日期</TableHead>
                <TableHead className="text-right">浮动盈亏</TableHead>
                <TableHead className="pr-4">换约</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={11}
                    className="text-center text-muted-foreground py-10"
                  >
                    暂无持仓
                  </TableCell>
                </TableRow>
              )}
              {positions.map((p) => {
                const avgEntry = Number(p.avg_entry_price)
                const lastPrice = Number(p.last_price ?? avgEntry)
                const stop = p.stop_loss_price
                  ? Number(p.stop_loss_price)
                  : null
                const roll = rollMap.get(`${p.symbol}|${p.contract_code}`)
                return (
                  <TableRow key={`${p.symbol}-${p.contract_code}`}>
                    <TableCell className="pl-4 font-medium">{p.symbol}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {p.contract_code}
                    </TableCell>
                    <TableCell>
                      <DirectionBadge
                        direction={p.qty > 0 ? "long" : "short"}
                      />
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono font-semibold ${pnlClass(p.qty)}`}
                    >
                      {p.qty > 0 ? "+" : ""}
                      {p.qty}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {avgEntry.toLocaleString("zh-CN")}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {lastPrice.toLocaleString("zh-CN")}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {stop !== null ? stop.toLocaleString("zh-CN") : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.group_name}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(p.opened_at)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono ${pnlClass(Number(p.unrealized_pnl ?? 0))}`}
                    >
                      {formatCurrency(Number(p.unrealized_pnl ?? 0), true)}
                    </TableCell>
                    <TableCell className="pr-4">
                      {roll ? (
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="destructive"
                            title={`${roll.symbol}: ${roll.current_contract} → ${roll.new_dominant_contract}`}
                          >
                            需换约 → {roll.new_dominant_contract}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openRollDialog(roll, p)}
                          >
                            换约完成
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>组级暴露度</CardTitle>
          <CardDescription>
            按 group_name 聚合的名义价值 — 监控集中度是否触达 portfolio_cap
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={groupExposure}
                layout="vertical"
                margin={{ top: 10, right: 40, left: 20, bottom: 10 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  opacity={0.1}
                />
                <XAxis
                  type="number"
                  stroke="currentColor"
                  opacity={0.5}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`}
                />
                <YAxis
                  type="category"
                  dataKey="group"
                  width={80}
                  stroke="currentColor"
                  opacity={0.6}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v) => [formatCurrency(Number(v ?? 0)), "名义价值"]}
                />
                <Bar dataKey="notional" radius={[0, 6, 6, 0]}>
                  {groupExposure.map((_, i) => (
                    <Cell key={i} fill={groupColors[i % groupColors.length]} />
                  ))}
                  <LabelList
                    dataKey="notional"
                    position="right"
                    formatter={(v) => `${(Number(v ?? 0) / 10000).toFixed(0)}万`}
                    style={{ fontSize: 11, fill: "currentColor" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 换约完成 Dialog（Q6 扩展）。用户在客户端平旧 + 开新后，
          在这里确认 → 后端 apply_roll 单事务完成 positions 迁移 + 审计链路。 */}
      <Dialog
        open={rollTarget !== null}
        onOpenChange={(o) => {
          if (!o) closeRollDialog()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>换约完成确认</DialogTitle>
            <DialogDescription>
              平旧开新已在客户端完成后点击确认 · 系统将同步 positions 并写入审计
            </DialogDescription>
          </DialogHeader>
          {rollTarget && (
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label className="text-xs text-muted-foreground">
                    旧合约
                  </Label>
                  <div className="font-mono text-sm">
                    {rollTarget.candidate.current_contract}
                  </div>
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs text-muted-foreground">
                    新合约
                  </Label>
                  <div className="font-mono text-sm">
                    {rollTarget.candidate.new_dominant_contract}
                  </div>
                </div>
              </div>
              <div className="grid gap-1">
                <Label className="text-xs text-muted-foreground">数量</Label>
                <div
                  className={`font-mono text-sm ${pnlClass(rollTarget.position.qty)}`}
                >
                  {rollTarget.position.qty > 0 ? "+" : ""}
                  {rollTarget.position.qty} 手（保持方向）
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>旧合约平仓均价</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={rollDraft.old_close_price}
                  onChange={(e) =>
                    setRollDraft((s) => ({
                      ...s,
                      old_close_price: e.target.value,
                    }))
                  }
                  disabled={isRollSubmitting}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>新合约开仓均价</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={rollDraft.new_open_price}
                  onChange={(e) =>
                    setRollDraft((s) => ({
                      ...s,
                      new_open_price: e.target.value,
                    }))
                  }
                  disabled={isRollSubmitting}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>备注（可选）</Label>
                <Textarea
                  placeholder="记录换约细节 / 价差原因等"
                  value={rollDraft.note}
                  onChange={(e) =>
                    setRollDraft((s) => ({ ...s, note: e.target.value }))
                  }
                  className="min-h-16"
                  disabled={isRollSubmitting}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeRollDialog}
              disabled={isRollSubmitting}
            >
              取消
            </Button>
            <Button
              onClick={handleRollSubmit}
              disabled={isRollSubmitting}
            >
              {isRollSubmitting ? "提交中…" : "确认换约"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
