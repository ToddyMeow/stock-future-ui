export default function DashboardPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">仪表盘</h1>
      <p className="text-muted-foreground mt-2">
        核心监控指标占位：累计 PnL / Sharpe / MaxDD / 胜率 / 今日 PnL / 待回填数 / 最近告警。
        P2a 阶段接入真实数据。
      </p>
    </div>
  )
}
