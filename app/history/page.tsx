export default function HistoryPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">历史查询</h1>
      <p className="text-muted-foreground mt-2">
        按日期查询历史指令 / 成交 / 每日 PnL 占位。支持日期范围选择和品种过滤。
        P2b 阶段接 /api/history。
      </p>
    </div>
  )
}
