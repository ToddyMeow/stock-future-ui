"use client"

/**
 * app/positions/positions-view.client.tsx — 当前持仓纯展示。
 *
 * 真实后端 Position 无 unrealized_pnl / last_price 字段（前端临时值），
 * 缺省时回退为 `last_price = avg_entry_price`，`unrealized_pnl = 0`。
 */
import { useMemo } from "react"
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
import { DirectionBadge, pnlClass } from "@/components/status-badges"
import {
  formatCurrency,
  formatDate,
} from "@/lib/mock"
import type { DailyPnl, Position } from "@/lib/types"

export function PositionsView({
  positions,
  pnl,
}: {
  positions: Position[]
  pnl: DailyPnl[]
}) {
  const latest = pnl[pnl.length - 1]
  const latestEquity = latest?.equity ?? 0

  const totalNotional = positions.reduce((acc, p) => {
    const last = p.last_price ?? Number(p.avg_entry_price)
    return acc + Math.abs(p.qty) * last * 10
  }, 0)
  const totalUnrealized = positions.reduce(
    (acc, p) => acc + (p.unrealized_pnl ?? 0),
    0,
  )

  // 按组聚合暴露
  const groupExposure = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of positions) {
      const last = p.last_price ?? Number(p.avg_entry_price)
      const notional = Math.abs(p.qty) * last * 10
      map.set(p.group_name, (map.get(p.group_name) ?? 0) + notional)
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
                <TableHead className="text-right">最新价</TableHead>
                <TableHead className="text-right">止损价</TableHead>
                <TableHead>策略组</TableHead>
                <TableHead>开仓日期</TableHead>
                <TableHead className="pr-4 text-right">浮动盈亏</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={10}
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
                      className={`pr-4 text-right font-mono ${pnlClass(p.unrealized_pnl ?? 0)}`}
                    >
                      {formatCurrency(p.unrealized_pnl ?? 0, true)}
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
    </div>
  )
}
