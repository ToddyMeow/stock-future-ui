"use client"

/**
 * app/analytics/analytics-view.client.tsx — 归因分析（V1 Morandi 设计）
 *
 * Tabs（按品种 / 按策略组）自绘 .seg；mini 走势用自绘 Spark；
 * 组视图改用 hairline 进度条（宽度 = weight 占比）避免 Pie 太花哨。
 */
import { useState } from "react"
import { Spark } from "@/components/charts/spark"
import { fmtPct, fmtY, signCls } from "@/lib/format"
import type { AnalyticsBreakdown } from "@/lib/types"

export function AnalyticsView({ data }: { data: AnalyticsBreakdown }) {
  const [tab, setTab] = useState<"symbol" | "group">("symbol")

  return (
    <>
      <h1 className="page">分析</h1>
      <div className="sub">按品种 / 策略组拆解 PnL · 胜率 · 近 10 笔走势</div>

      <div className="seg" style={{ marginTop: 16 }}>
        <button className={tab === "symbol" ? "on" : ""} onClick={() => setTab("symbol")}>
          按品种
        </button>
        <button className={tab === "group" ? "on" : ""} onClick={() => setTab("group")}>
          按策略组
        </button>
      </div>

      {tab === "symbol" ? (
        <div className="card-va" style={{ marginTop: 16 }}>
          <div className="hd">
            <div className="ti">品种归因</div>
            <div className="de">累计盈亏 · 胜率 · 近 10 笔 mini 走势</div>
          </div>
          <div className="bd" style={{ padding: 0 }}>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ paddingLeft: 16 }}>品种</th>
                    <th>策略组</th>
                    <th className="ta-r">次数</th>
                    <th className="ta-r">胜率</th>
                    <th className="ta-r">累计 PnL</th>
                    <th style={{ paddingRight: 16 }}>近 10 笔</th>
                  </tr>
                </thead>
                <tbody>
                  {data.by_symbol.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        style={{
                          textAlign: "center",
                          color: "var(--graphite-500)",
                          padding: "40px 12px",
                        }}
                      >
                        暂无归因数据（fills 表为空）
                      </td>
                    </tr>
                  )}
                  {data.by_symbol.map((s) => (
                    <tr key={s.symbol}>
                      <td style={{ paddingLeft: 16, fontWeight: 500 }}>{s.symbol}</td>
                      <td style={{ fontSize: 11, color: "var(--graphite-500)" }}>
                        {s.group_name}
                      </td>
                      <td className="ta-r num">{s.trade_count}</td>
                      <td className={`ta-r num ${s.win_rate >= 0.5 ? "pos" : "neg"}`}>
                        {fmtPct(s.win_rate, 1)}
                      </td>
                      <td className={`ta-r num ${signCls(s.pnl_cumulative)}`}>
                        {fmtY(s.pnl_cumulative, true)}
                      </td>
                      <td style={{ paddingRight: 16 }}>
                        <Spark
                          data={s.recent_pnl_series.map((p) => p.pnl)}
                          w={120}
                          h={28}
                          stroke={
                            s.pnl_cumulative >= 0
                              ? "var(--pnl-pos)"
                              : "var(--pnl-neg)"
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: 12,
            marginTop: 16,
          }}
        >
          {data.by_group.length === 0 && (
            <div
              className="card-va"
              style={{
                padding: 32,
                textAlign: "center",
                color: "var(--graphite-500)",
              }}
            >
              暂无策略组归因
            </div>
          )}
          {data.by_group.map((g) => {
            const total = g.symbols.reduce((a, x) => a + x.weight, 0) || 1
            return (
              <div key={g.group_name} className="card-va">
                <div
                  className="hd"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div className="ti">{g.group_name}</div>
                    <div className="de">{g.symbols.length} 个品种</div>
                  </div>
                  <span
                    className={`pill ${g.pnl_cumulative >= 0 ? "filled" : "vetoed"}`}
                  >
                    <span className="dot" />
                    {fmtY(g.pnl_cumulative, true)}
                  </span>
                </div>
                <div
                  className="bd"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    padding: "4px 16px 14px",
                  }}
                >
                  {g.symbols.map((x) => {
                    const w = x.weight / total
                    return (
                      <div key={x.symbol}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 12,
                            marginBottom: 4,
                          }}
                        >
                          <span>
                            <span style={{ fontWeight: 500 }}>{x.symbol}</span>
                            <span
                              style={{
                                color: "var(--graphite-500)",
                                marginLeft: 6,
                              }}
                            >
                              {fmtPct(w, 0)}
                            </span>
                          </span>
                          <span className={`num ${signCls(x.pnl)}`}>
                            {fmtY(x.pnl, true)}
                          </span>
                        </div>
                        <div
                          style={{
                            height: 4,
                            background: "var(--porcelain-100)",
                            borderRadius: 2,
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${w * 100}%`,
                              background:
                                x.pnl >= 0 ? "var(--pnl-pos)" : "var(--pnl-neg)",
                              borderRadius: 2,
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
