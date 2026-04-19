type Params = Promise<{ date: string }>

export default async function DailyReportPage({ params }: { params: Params }) {
  const { date } = await params
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">每日报告 · {date}</h1>
      <p className="text-muted-foreground mt-2">
        指定日期报告占位：当日盈亏、成交明细、指令执行率、重大事件。
        URL /reports/today 是 alias，实际会走 /reports/YYYY-MM-DD。
        P2b 阶段接 /api/reports/{date}。
      </p>
    </div>
  )
}
