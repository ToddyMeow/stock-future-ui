/** 小型折线图（sparkline）—— 仅展示一条线 + 零线。 */
export function Spark({
  data,
  w = 120,
  h = 28,
  stroke = "var(--graphite-500)",
  sw = 1.5,
}: {
  data: number[]
  w?: number
  h?: number
  stroke?: string
  sw?: number
}) {
  if (!data.length) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const r = max - min || 1
  const x = (i: number) =>
    data.length === 1 ? w / 2 : (i / (data.length - 1)) * w
  const y = (v: number) => h - ((v - min) / r) * h
  const path = data
    .map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(d).toFixed(1)}`)
    .join(" ")
  const zero = min <= 0 && 0 <= max ? y(0) : null
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      {zero != null && (
        <line
          x1="0"
          x2={w}
          y1={zero}
          y2={zero}
          stroke="var(--porcelain-300)"
          strokeDasharray="2 2"
          strokeWidth="1"
        />
      )}
      <path d={path} fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
    </svg>
  )
}

/** 横向柱状图（HBar）—— 用于品种/组的名义价值、暴露度可视化。 */
export function HBar({
  data,
  w = 780,
  h = 160,
  valueOf,
  labelOf,
  color = "var(--mist)",
}: {
  data: unknown[]
  w?: number
  h?: number
  valueOf: (d: unknown) => number
  labelOf: (d: unknown) => string
  color?: string
}) {
  if (!data.length) {
    return (
      <div style={{ color: "var(--graphite-500)", fontSize: 12, padding: 16 }}>
        暂无数据
      </div>
    )
  }
  const pad = { l: 80, r: 86, t: 4, b: 4 }
  const iw = w - pad.l - pad.r
  const max = Math.max(...data.map(valueOf)) || 1
  const rowH = (h - pad.t - pad.b) / data.length

  return (
    <svg
      className="chart-surface"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", height: "100%" }}
    >
      {data.map((d, i) => {
        const v = valueOf(d)
        const bw = (v / max) * iw
        const y = pad.t + i * rowH + rowH * 0.2
        const bh = rowH * 0.6
        return (
          <g key={i}>
            <text
              x={pad.l - 10}
              y={y + bh / 2 + 3}
              textAnchor="end"
              className="chart-axis"
              style={{ fontSize: 11 }}
            >
              {labelOf(d)}
            </text>
            <rect x={pad.l} y={y} width={bw} height={bh} fill={color} rx="2" />
            <text
              x={pad.l + bw + 6}
              y={y + bh / 2 + 3}
              className="chart-axis"
              style={{ fontSize: 11 }}
            >
              {(v / 10000).toFixed(0)}万
            </text>
          </g>
        )
      })}
    </svg>
  )
}
