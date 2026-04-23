"use client"

/**
 * app/dashboard-view.client.tsx — 仪表盘（V1 Morandi 设计）
 *
 * 从 RSC 父拿 props（pnlSeries / instructions / alerts / rolls）。
 * LineChart 是自绘 SVG（tooltip 带 hover 游标），client 即可。
 */
import Link from "next/link"
import { LineChart } from "@/components/charts/line-chart"
import { SevPill } from "@/components/pills"
import { fmtPct, fmtY, signCls, shortTime } from "@/lib/format"
import type {
  Alert,
  DailyPnl,
  Instruction,
  RollCandidate,
} from "@/lib/types"

function nowLine() {
  const d = new Date()
  const weekday = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()]
  const iso = d.toISOString().slice(0, 10)
  const t = `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`
  const hour = d.getHours()
  const session = hour < 8 || hour >= 15 ? "夜盘准备中" : "日盘进行中"
  return `${iso} · 星期${weekday} · ${session} ${t} CST`
}

export function DashboardView({
  pnlSeries,
  instructions,
  alerts,
  rolls = [],
}: {
  pnlSeries: DailyPnl[]
  instructions: Instruction[]
  alerts: Alert[]
  rolls?: RollCandidate[]
}) {
  if (pnlSeries.length === 0) {
    return (
      <div style={{ padding: 24 }}>
        <h1 className="page">仪表盘</h1>
        <div className="sub">{nowLine()}</div>
        <div className="card-va" style={{ marginTop: 24 }}>
          <div className="hd">
            <div className="ti">暂无权益数据</div>
            <div className="de">daily_pnl 为空 — 请先运行首次日结</div>
          </div>
        </div>
      </div>
    )
  }

  const latest = pnlSeries.at(-1)!
  const prev = pnlSeries.at(-2) ?? latest
  const first = pnlSeries[0]
  const pnlToday = latest.equity - prev.equity
  const cum = latest.equity - first.equity
  const maxDD = Math.min(...pnlSeries.map((d) => d.drawdown_from_peak ?? 0))

  const pendingCount = instructions.filter(
    (i) => i.status === "pending" || i.status === "partially_filled",
  ).length

  const topAlerts = alerts.slice(0, 5)

  const chartData = pnlSeries.map((d) => ({
    date: d.date,
    equity: d.equity,
  }))

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 className="page">仪表盘</h1>
          <div className="sub">{nowLine()}</div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span className="pill filled">
            <span className="dot" />
            引擎运行中
          </span>
          <button
            className="btn"
            onClick={() => {
              if (typeof window !== "undefined") window.location.reload()
            }}
          >
            刷新
          </button>
        </div>
      </div>

      {/* KPI Grid —— 4 列（含 Q6 待换约时转 5 列） */}
      <div
        className="kpis"
        style={{
          gridTemplateColumns: rolls.length > 0 ? "repeat(5, 1fr)" : undefined,
        }}
      >
        <div className="kpi">
          <div className="l">今日盈亏</div>
          <div className={`v ${signCls(pnlToday)}`}>{fmtY(pnlToday, true)}</div>
          <div className="m">
            较昨日结算{" "}
            <span className={signCls(pnlToday)}>
              {fmtPct(prev.equity > 0 ? pnlToday / prev.equity : 0, 2)}
            </span>
          </div>
        </div>
        <div className="kpi">
          <div className="l">累计盈亏</div>
          <div className={`v ${signCls(cum)}`}>{fmtY(cum, true)}</div>
          <div className="m">
            起始 {fmtY(first.equity)} ·{" "}
            <span className={signCls(cum)}>
              {fmtPct(first.equity > 0 ? cum / first.equity : 0, 1)}
            </span>
          </div>
        </div>
        <div className="kpi">
          <div className="l">最大回撤</div>
          <div className="v neg">{fmtPct(maxDD, 2)}</div>
          <div className="m">soft_stop 未触发 · cap −12%</div>
        </div>
        <div className="kpi">
          <div className="l">待回填</div>
          <div className="v">
            <span>{pendingCount}</span>
            <span
              style={{
                fontSize: 14,
                color: "var(--graphite-500)",
                marginLeft: 6,
              }}
            >
              条
            </span>
          </div>
          <div className="m">
            <Link
              href="/instructions"
              style={{ color: "var(--graphite-700)" }}
            >
              → 前往回填
            </Link>
          </div>
        </div>
        {rolls.length > 0 && (
          <Link
            href="/positions"
            className="kpi"
            style={{
              textDecoration: "none",
              borderColor: "var(--pnl-neg-soft)",
            }}
          >
            <div className="l">待换约</div>
            <div className="v neg">
              <span>{rolls.length}</span>
              <span
                style={{
                  fontSize: 14,
                  color: "var(--graphite-500)",
                  marginLeft: 6,
                }}
              >
                条
              </span>
            </div>
            <div className="m">
              {rolls
                .map((r) => r.symbol)
                .slice(0, 3)
                .join(" / ")}
              {rolls.length > 3 ? " …" : ""} · 点击查看
            </div>
          </Link>
        )}
      </div>

      <div className="grid-3">
        <div className="card-va">
          <div
            className="hd"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div className="ti">账户权益 · 近 {pnlSeries.length} 日</div>
              <div className="de">
                起始 {fmtY(first.equity)} → 最新{" "}
                <span
                  className={signCls(cum)}
                  style={{ fontWeight: 500 }}
                >
                  {fmtY(latest.equity)}
                </span>
              </div>
            </div>
            <span className="eye">{pnlSeries.length}D</span>
          </div>
          <div
            className="bd"
            style={{ height: 260, padding: "0 8px 8px" }}
          >
            <LineChart data={chartData} w={760} h={250} stroke="var(--mist-deep)" />
          </div>
        </div>

        <div className="card-va">
          <div className="hd">
            <div className="ti">最近告警</div>
            <div className="de">当日系统事件 · {alerts.length} 条</div>
          </div>
          <div
            className="bd"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              padding: "0 14px 14px",
            }}
          >
            {topAlerts.length === 0 && (
              <p
                style={{
                  fontSize: 12,
                  color: "var(--graphite-500)",
                  margin: 0,
                  padding: "8px 0",
                }}
              >
                暂无告警
              </p>
            )}
            {topAlerts.map((a, i) => (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  gap: 8,
                  paddingTop: 10,
                  borderTop: i
                    ? "1px solid var(--porcelain-100)"
                    : "none",
                }}
              >
                <SevPill sev={a.severity} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                    {a.message}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--graphite-500)",
                      marginTop: 3,
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {shortTime(a.event_at)} · {a.event_type}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
