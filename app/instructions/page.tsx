export default function InstructionsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">今日指令</h1>
      <p className="text-muted-foreground mt-2">
        今日待回填指令列表 + 回填表单占位。每行可录入成交量 / 成交价 / 否决 + 原因 / skipped。
        P2b 阶段接 /api/instructions。
      </p>
    </div>
  )
}
