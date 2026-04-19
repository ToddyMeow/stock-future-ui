export default function PositionsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">当前持仓</h1>
      <p className="text-muted-foreground mt-2">
        实时持仓表占位：品种 / 方向 / 开仓价 / 当前价 / 浮动盈亏 / 止损 / 止盈。
        P2b 阶段接 /api/positions。
      </p>
    </div>
  )
}
