/**
 * app/reports/[date]/page.tsx — 每日报告（RSC）
 *
 * - 特殊路径 `today` 解析为当日
 * - 拉 fetchReport + fetchDailyPnl（后者画 90 日趋势）
 * - 任一失败整页降级 mock
 */
import Link from "next/link"
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
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { pnlClass } from "@/components/status-badges"
import { MockBanner } from "@/components/mock-banner"
import {
  fetchDailyPnl,
  fetchOrMock,
  fetchReport,
} from "@/lib/api"
import {
  formatCurrency,
  formatPct,
  mockDailyPnl,
  mockDailyReport,
} from "@/lib/mock"
import { STATUS_LABELS } from "@/lib/types"
import { DailyReportChart } from "./chart.client"

type Params = Promise<{ date: string }>

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function normalizeDate(d: string): string {
  if (d === "today") return todayStr()
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d
  return todayStr()
}

function shiftDate(d: string, days: number): string {
  return new Date(Date.parse(d) + days * 86400_000)
    .toISOString()
    .slice(0, 10)
}

export default async function DailyReportPage({
  params,
}: {
  params: Params
}) {
  const { date: raw } = await params
  const date = normalizeDate(raw)
  const from = shiftDate(date, -90)

  const [reportResult, pnlResult] = await Promise.all([
    fetchOrMock(
      () => fetchReport(date),
      () => mockDailyReport(date),
    ),
    fetchOrMock(
      () => fetchDailyPnl(from, date),
      () => mockDailyPnl(90),
    ),
  ])

  const report = reportResult.data
  const pnlSeries = pnlResult.data
  const isMock = reportResult.isMock || pnlResult.isMock
  const mockReason = reportResult.error ?? pnlResult.error

  const { kpi, daily_pnl, instructions_summary, vetoed_list } = report
  const prevDay = shiftDate(date, -1)
  const nextDay = shiftDate(date, 1)
  const chartData = pnlSeries.map((d) => ({
    date: d.date.slice(5),
    fullDate: d.date,
    equity: d.equity,
  }))

  return (
    <>
      {isMock && <MockBanner reason={mockReason} />}
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              每日报告 · {date}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              权益 · KPI · 指令执行 · 人工否决归因
            </p>
          </div>
          <div className="flex gap-2">
            <Link href={`/reports/${prevDay}`}>
              <Button variant="outline" size="sm">
                ← 上一日 {prevDay.slice(5)}
              </Button>
            </Link>
            <Link href={`/reports/${nextDay}`}>
              <Button variant="outline" size="sm">
                下一日 {nextDay.slice(5)} →
              </Button>
            </Link>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <Card size="sm">
            <CardHeader>
              <CardDescription>今日盈亏</CardDescription>
              <CardTitle
                className={`text-xl font-bold ${pnlClass(kpi.pnl_today)}`}
              >
                {formatCurrency(kpi.pnl_today, true)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardDescription>累计盈亏</CardDescription>
              <CardTitle
                className={`text-xl font-bold ${pnlClass(kpi.pnl_cumulative)}`}
              >
                {formatCurrency(kpi.pnl_cumulative, true)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardDescription>Sharpe</CardDescription>
              <CardTitle className="text-xl font-bold">
                {kpi.sharpe.toFixed(2)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardDescription>最大回撤</CardDescription>
              <CardTitle className="text-xl font-bold text-red-600">
                {formatPct(kpi.max_drawdown, 2)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardDescription>今日交易</CardDescription>
              <CardTitle className="text-xl font-bold">
                {kpi.trade_count_today}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card size="sm">
            <CardHeader>
              <CardDescription>今日否决</CardDescription>
              <CardTitle className="text-xl font-bold text-red-600">
                {kpi.veto_count_today}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* 权益曲线 */}
        <Card>
          <CardHeader>
            <CardTitle>账户权益 · 近 90 日</CardTitle>
            <CardDescription>
              当前报告日期标红；峰值权益{" "}
              {formatCurrency(daily_pnl.peak_equity_to_date ?? daily_pnl.equity)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DailyReportChart data={chartData} highlightDate={date} />
          </CardContent>
        </Card>

        {/* 指令执行汇总 + 否决归因 */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>指令执行汇总</CardTitle>
              <CardDescription>按状态拆解今日所有指令</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">指令数</TableHead>
                    <TableHead className="text-right">占比</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(
                    Object.entries(instructions_summary) as [
                      keyof typeof instructions_summary,
                      number,
                    ][]
                  ).map(([k, v]) => {
                    const total = Object.values(instructions_summary).reduce(
                      (s, x) => s + x,
                      0,
                    )
                    return (
                      <TableRow key={k}>
                        <TableCell>{STATUS_LABELS[k]}</TableCell>
                        <TableCell className="text-right font-mono">
                          {v}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {formatPct(total === 0 ? 0 : v / total, 0)}
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
              <CardTitle>人工否决归因</CardTitle>
              <CardDescription>
                记录下本日所有 vetoed 的原因，供策略迭代参考
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {vetoed_list.length === 0 ? (
                <p className="text-sm text-muted-foreground">今日无否决</p>
              ) : (
                vetoed_list.map((v, i) => (
                  <div key={`${v.symbol}-${i}`}>
                    <div className="flex items-start gap-2">
                      <Badge className="bg-red-100 text-red-700 border-transparent dark:bg-red-950 dark:text-red-300">
                        {v.symbol}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-snug">{v.reason}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                          {v.contract_code}
                        </p>
                      </div>
                    </div>
                    {i < vetoed_list.length - 1 && <Separator className="mt-3" />}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-between pt-2">
          <Link href={`/reports/${prevDay}`}>
            <Button variant="outline" size="sm">
              ← 上一日 {prevDay}
            </Button>
          </Link>
          <Link href={`/reports/${nextDay}`}>
            <Button variant="outline" size="sm">
              下一日 {nextDay} →
            </Button>
          </Link>
        </div>
      </div>
    </>
  )
}
