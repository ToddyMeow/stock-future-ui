"use client"

/**
 * app/analytics/analytics-view.client.tsx — 归因展示（recharts 必须 client）。
 */
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { pnlClass } from "@/components/status-badges"
import { formatCurrency, formatPct } from "@/lib/mock"
import type { AnalyticsBreakdown } from "@/lib/types"

const GROUP_COLORS = ["#16a34a", "#2563eb", "#ea580c", "#7c3aed", "#0891b2", "#db2777", "#ca8a04", "#0d9488"]

export function AnalyticsView({ data }: { data: AnalyticsBreakdown }) {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">分析</h1>
        <p className="text-sm text-muted-foreground mt-1">
          按品种 / 策略组拆解 PnL · 胜率 · 最近交易走势
        </p>
      </div>

      <Tabs defaultValue="symbol">
        <TabsList>
          <TabsTrigger value="symbol">按品种</TabsTrigger>
          <TabsTrigger value="group">按策略组</TabsTrigger>
        </TabsList>

        {/* 按品种 */}
        <TabsContent value="symbol" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>品种归因</CardTitle>
              <CardDescription>
                累计盈亏 · 胜率 · 最近 10 笔 mini 走势
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">品种</TableHead>
                    <TableHead>策略组</TableHead>
                    <TableHead className="text-right">交易次数</TableHead>
                    <TableHead className="text-right">胜率</TableHead>
                    <TableHead className="text-right">累计 PnL</TableHead>
                    <TableHead className="pr-4">近 10 笔走势</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.by_symbol.map((s) => (
                    <TableRow key={s.symbol}>
                      <TableCell className="pl-4 font-medium">
                        {s.symbol}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {s.group_name}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {s.trade_count}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono ${
                          s.win_rate >= 0.5 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {formatPct(s.win_rate, 1)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono ${pnlClass(s.pnl_cumulative)}`}
                      >
                        {formatCurrency(s.pnl_cumulative, true)}
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="h-10 w-32">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={s.recent_pnl_series}>
                              <Line
                                type="monotone"
                                dataKey="pnl"
                                stroke={
                                  s.pnl_cumulative >= 0 ? "#16a34a" : "#dc2626"
                                }
                                strokeWidth={1.5}
                                dot={false}
                              />
                              <Tooltip
                                contentStyle={{
                                  background: "var(--popover)",
                                  border: "1px solid var(--border)",
                                  borderRadius: 8,
                                  fontSize: 11,
                                  padding: "2px 6px",
                                }}
                                formatter={(v) => [
                                  formatCurrency(Number(v ?? 0), true),
                                  "单笔",
                                ]}
                                labelFormatter={() => ""}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 按策略组 */}
        <TabsContent value="group" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.by_group.map((g) => {
              const total = g.symbols.reduce((s, x) => s + x.weight, 0)
              const pieData = g.symbols.map((x) => ({
                name: x.symbol,
                value: x.weight / total,
              }))
              return (
                <Card key={g.group_name}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{g.group_name}</span>
                      <Badge
                        className={`${
                          g.pnl_cumulative >= 0
                            ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                            : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                        } border-transparent`}
                      >
                        {formatCurrency(g.pnl_cumulative, true)}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      {g.symbols.length} 个品种
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-[120px_1fr] gap-4 items-center">
                      <div className="h-28 w-28">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieData}
                              dataKey="value"
                              innerRadius={22}
                              outerRadius={46}
                              paddingAngle={2}
                              stroke="var(--background)"
                            >
                              {pieData.map((_, i) => (
                                <Cell
                                  key={i}
                                  fill={GROUP_COLORS[i % GROUP_COLORS.length]}
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                background: "var(--popover)",
                                border: "1px solid var(--border)",
                                borderRadius: 8,
                                fontSize: 11,
                              }}
                              formatter={(v) => [
                                formatPct(Number(v ?? 0), 0),
                                "权重",
                              ]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-col gap-1.5 text-xs">
                        {g.symbols.map((x, i) => (
                          <div
                            key={x.symbol}
                            className="flex items-center justify-between gap-2"
                          >
                            <span className="flex items-center gap-1.5">
                              <span
                                className="size-2 rounded-full inline-block"
                                style={{
                                  background:
                                    GROUP_COLORS[i % GROUP_COLORS.length],
                                }}
                              />
                              <span className="font-medium">{x.symbol}</span>
                              <span className="text-muted-foreground">
                                {formatPct(x.weight / total, 0)}
                              </span>
                            </span>
                            <span
                              className={`font-mono ${pnlClass(x.pnl)}`}
                            >
                              {formatCurrency(x.pnl, true)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
