export default function AnalyticsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">分析</h1>
      <p className="text-muted-foreground mt-2">
        品种 / 策略 breakdown 占位：按品种汇总的胜率、期望、Sharpe；按策略维度的资金曲线对比。
        P2a 阶段用 recharts 接入。
      </p>
    </div>
  )
}
