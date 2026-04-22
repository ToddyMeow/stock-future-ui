"use client"

/**
 * app/dashboard-view.client.tsx — 仪表盘纯展示组件
 *
 * 从 RSC 父拿 props，使用 recharts 必须 client。
 */
import Link from "next/link"
import {
  CartesianGrid,
  Line,
  LineChart,
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { pnlClass, SeverityBadge } from "@/components/status-badges"
import {
  formatCurrency,
  formatPct,
  formatTime,
} from "@/lib/mock"
import type { Alert, DailyPnl, Instruction, RollCandidate } from "@/lib/types"

export function DashboardView({
  pnlSeries,
  instructions,
  alerts,
  rolls = [],
}: {
  pnlSeries: DailyPnl[]
  instructions: Instruction[]
  alerts: Alert[]
  rolls?: RollCandidate[]
}) {
  // 边界：空序列占位（极少概率——后端新账户第一天）
  if (pnlSeries.length === 0) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>暂无权益数据</CardTitle>
            <CardDescription>
              account_state.daily_pnl 为空 — 请先运行首次日结
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const latest = pnlSeries[pnlSeries.length - 1]
  const prev = pnlSeries[pnlSeries.length - 2] ?? latest
  const first = pnlSeries[0]
  const pnlToday = latest.equity - prev.equity
  const pnlCumulative = latest.equity - first.equity
  const cumPct = first.equity > 0 ? pnlCumulative / first.equity : 0
  const maxDD = Math.min(
    ...pnlSeries.map((d) => d.drawdown_from_peak ?? 0),
  )

  const pendingCount = instructions.filter(
    (i) => i.status === "pending" || i.status === "partially_filled",
  ).length

  const topAlerts = alerts.slice(0, 3)

  const chartData = pnlSeries.map((d) => ({
    date: d.date.slice(5), // MM-DD
    equity: d.equity,
  }))

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">仪表盘</h1>
        <p className="text-sm text-muted-foreground mt-1">
          账户权益 · 核心 KPI · 今日待办 · 最近告警
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <Card>
          <CardHeader>
            <CardDescription>今日盈亏</CardDescription>
            <CardTitle
              className={`text-2xl font-bold ${pnlClass(pnlToday)}`}
            >
              {formatCurrency(pnlToday, true)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              相对昨日结算{" "}
              {formatPct(prev.equity > 0 ? pnlToday / prev.equity : 0, 2)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>累计盈亏</CardDescription>
            <CardTitle
              className={`text-2xl font-bold ${pnlClass(pnlCumulative)}`}
            >
              {formatCurrency(pnlCumulative, true)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              起始资金 {formatCurrency(first.equity)} · 收益率{" "}
              <span className={pnlClass(cumPct)}>{formatPct(cumPct, 1)}</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Sharpe Ratio (90d)</CardDescription>
            <CardTitle className="text-2xl font-bold text-muted-foreground">
              —
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              实盘样本不足 90 日，暂不计算
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>最大回撤</CardDescription>
            <CardTitle className="text-2xl font-bold text-red-600">
              {formatPct(maxDD, 2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              soft_stop 一期已关闭（Q3）
            </p>
          </CardContent>
        </Card>
        {/* Q6：待换约 KPI 卡 — 数字 > 0 时红色，点击跳 /positions */}
        <Link href="/positions" className="block">
          <Card
            className={
              rolls.length > 0
                ? "border-destructive transition-colors hover:bg-muted/40 cursor-pointer"
                : "transition-colors hover:bg-muted/40 cursor-pointer"
            }
          >
            <CardHeader>
              <CardDescription>待换约</CardDescription>
              <CardTitle
                className={`text-2xl font-bold ${
                  rolls.length > 0 ? "text-red-600" : ""
                }`}
              >
                {rolls.length} 条
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {rolls.length > 0
                  ? `${rolls.map((r) => r.symbol).slice(0, 3).join(" / ")}${
                      rolls.length > 3 ? " ..." : ""
                    } · 点击查看`
                  : "持仓全部对齐最新主力合约"}
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* 权益曲线 + 侧栏 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>账户权益 · 近 90 日</CardTitle>
            <CardDescription>
              起始 {formatCurrency(first.equity)} → 最新{" "}
              <span className={pnlClass(pnlCumulative)}>
                {formatCurrency(latest.equity)}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="currentColor"
                    opacity={0.1}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    interval={8}
                    stroke="currentColor"
                    opacity={0.5}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="currentColor"
                    opacity={0.5}
                    tickFormatter={(v) =>
                      `${(v / 10000).toFixed(0)}万`
                    }
                    domain={["dataMin - 20000", "dataMax + 20000"]}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v) => [formatCurrency(Number(v ?? 0)), "权益"]}
                    labelFormatter={(l) => `日期 ${l}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="equity"
                    stroke="#16a34a"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>待回填指令</span>
                {pendingCount > 0 && (
                  <Badge className="bg-red-600 text-white">
                    {pendingCount}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>未完成的指令等待操作</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/instructions">
                <Button className="w-full">前往今日指令</Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>最近告警</CardTitle>
              <CardDescription>当日系统事件</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {topAlerts.length === 0 && (
                <p className="text-xs text-muted-foreground">暂无告警</p>
              )}
              {topAlerts.map((a, i) => (
                <div key={a.id}>
                  <div className="flex items-start gap-2">
                    <SeverityBadge severity={a.severity} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug">{a.message}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatTime(a.event_at)} · {a.event_type}
                      </p>
                    </div>
                  </div>
                  {i < topAlerts.length - 1 && <Separator className="mt-3" />}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
