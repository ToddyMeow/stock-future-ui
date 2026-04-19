"use client"

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { formatCurrency } from "@/lib/mock"

type Datum = { date: string; fullDate: string; equity: number }

export function DailyReportChart({
  data,
  highlightDate,
}: {
  data: Datum[]
  highlightDate: string
}) {
  const highlight = data.find((d) => d.fullDate === highlightDate)

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
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
            tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`}
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
          {highlight && (
            <ReferenceDot
              x={highlight.date}
              y={highlight.equity}
              r={6}
              fill="#dc2626"
              stroke="#fff"
              strokeWidth={2}
              label={{
                value: "当前报告",
                position: "top",
                fontSize: 11,
                fill: "#dc2626",
              }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
