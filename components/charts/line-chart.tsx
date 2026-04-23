"use client"

import { useState } from "react"
import { fmtY } from "@/lib/format"

type Point = { date: string; equity: number }

/**
 * 账户权益走势图（SVG）。
 *  - 5 条网格线 + 5 个 x 轴刻度
 *  - hover 显示游标 + tooltip（黑底白字）
 *  - 面积填充用线条颜色的 8% 透明
 */
export function LineChart({
  data,
  w = 760,
  h = 250,
  stroke = "var(--mist-deep)",
  fill = true,
}: {
  data: Point[]
  w?: number
  h?: number
  stroke?: string
  fill?: boolean
}) {
  const [hover, setHover] = useState<number | null>(null)

  if (!data.length) {
    return (
      <div
        style={{
          height: h,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--graphite-500)",
          fontSize: 12,
        }}
      >
        暂无数据
      </div>
    )
  }

  const pad = { l: 48, r: 12, t: 10, b: 22 }
  const iw = w - pad.l - pad.r
  const ih = h - pad.t - pad.b
  const label = (v: number) => `${(v / 10000).toFixed(0)}万`

  const ys = data.map((d) => d.equity)
  const yMin = Math.min(...ys)
  const yMax = Math.max(...ys)
  const yRange = yMax - yMin || 1
  const x = (i: number) =>
    pad.l + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw)
  const y = (v: number) => pad.t + ih - ((v - yMin) / yRange) * ih

  const path = data
    .map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(d.equity).toFixed(1)}`)
    .join(" ")
  const area = `${path} L${x(data.length - 1)} ${pad.t + ih} L${x(0)} ${pad.t + ih} Z`

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => yMin + yRange * t)
  const xTickIdx = [0, 0.25, 0.5, 0.75, 1].map((t) =>
    Math.round((data.length - 1) * t),
  )

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * w
    if (px < pad.l || px > w - pad.r) {
      setHover(null)
      return
    }
    const i = Math.round(((px - pad.l) / iw) * (data.length - 1))
    setHover(Math.max(0, Math.min(data.length - 1, i)))
  }

  return (
    <svg
      className="chart-surface"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
    >
      {ticks.map((t, i) => (
        <g key={i}>
          <line
            className="chart-grid"
            x1={pad.l}
            x2={w - pad.r}
            y1={y(t)}
            y2={y(t)}
          />
          <text
            className="chart-axis"
            x={pad.l - 6}
            y={y(t) + 3}
            textAnchor="end"
          >
            {label(t)}
          </text>
        </g>
      ))}
      {xTickIdx.map((i, k) => (
        <text
          key={k}
          className="chart-axis"
          x={x(i)}
          y={h - 6}
          textAnchor="middle"
        >
          {data[i].date.slice(5)}
        </text>
      ))}
      {fill && <path d={area} fill={stroke} className="chart-area" />}
      <path d={path} className="chart-line" stroke={stroke} />
      {hover != null && (
        <g>
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={pad.t}
            y2={pad.t + ih}
            stroke="var(--graphite-500)"
            strokeDasharray="2 3"
            strokeWidth="1"
          />
          <circle
            cx={x(hover)}
            cy={y(data[hover].equity)}
            r="4"
            fill="var(--card)"
            stroke={stroke}
            strokeWidth="2"
          />
          <g
            transform={`translate(${Math.min(x(hover) + 8, w - 130)}, ${Math.max(
              y(data[hover].equity) - 34,
              pad.t,
            )})`}
          >
            <rect width="122" height="30" rx="4" fill="var(--graphite-900)" opacity="0.94" />
            <text
              x="8"
              y="12"
              fill="var(--porcelain-50)"
              style={{
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.02em",
              }}
            >
              {data[hover].date}
            </text>
            <text
              x="8"
              y="25"
              fill="var(--porcelain-50)"
              style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 500 }}
            >
              {fmtY(data[hover].equity)}
            </text>
          </g>
        </g>
      )}
    </svg>
  )
}
