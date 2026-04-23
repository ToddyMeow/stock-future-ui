"use client"

/**
 * app/engine-status/engine-status-view.client.tsx — 引擎状态（V1 Morandi 设计）
 *
 * 布局：KPI 5 列（心跳 / 今日信号 / 近 7 天 / 24h 告警 / 下次触发）
 *      + 14 天指令直方图 + launchd 计划表 + 最近告警。
 * 每 30s 轮询；倒计时本地每秒刷新。
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { SevPill } from "@/components/pills"
import { fetchEngineStatus } from "@/lib/api"
import { fmtY, toNum } from "@/lib/format"
import type { EngineStatus, LaunchdSlot } from "@/lib/types"

const REFRESH_MS = 30_000

function fmtHHMM(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}
function fmtMMDDHHMM(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}
function fmtCountdown(ms: number): string {
  if (ms <= 0) return "即将触发"
  const totalMin = Math.floor(ms / 60_000)
  const days = Math.floor(totalMin / (60 * 24))
  const hours = Math.floor((totalMin % (60 * 24)) / 60)
  const minutes = totalMin % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}
function fmtRelativePast(iso: string, nowMs: number): string {
  const t = new Date(iso).getTime()
  const diff = nowMs - t
  if (diff < 0) return "未来"
  const min = Math.floor(diff / 60_000)
  if (min < 1) return "刚刚"
  if (min < 60) return `${min} 分钟前`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} 小时前`
  const d = Math.floor(h / 24)
  return `${d} 天前`
}
function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

export function EngineStatusView({ initial }: { initial: EngineStatus }) {
  const [status, setStatus] = useState<EngineStatus>(initial)
  const [refreshedAt, setRefreshedAt] = useState<number>(Date.now())
  const [now, setNow] = useState<number>(Date.now())
  const [pollError, setPollError] = useState<string | null>(null)

  const poll = useCallback(async () => {
    try {
      const data = await fetchEngineStatus()
      setStatus(data)
      setPollError(null)
      setRefreshedAt(Date.now())
    } catch (err) {
      setPollError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  useEffect(() => {
    const id = setInterval(poll, REFRESH_MS)
    return () => clearInterval(id)
  }, [poll])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const today = status.instructions_by_date.at(-1)
  const todayTotal = today?.total ?? 0
  const todayBreakdown = today?.by_status ?? {}
  const sevenDayTotal = useMemo(
    () => status.instructions_by_date.slice(-7).reduce((a, d) => a + d.total, 0),
    [status.instructions_by_date],
  )
  const alertCount = status.alerts_24h_count
  const totalAlerts24h =
    (alertCount?.info ?? 0) + (alertCount?.warn ?? 0) + (alertCount?.critical ?? 0)

  const nextSlot: LaunchdSlot | null =
    status.launchd_schedule.find((s) => new Date(s.next_fire).getTime() > now) ??
    status.launchd_schedule[0] ??
    null

  const state = status.latest_state
  const capital = status.capital_snapshot
  const recentAlerts = status.recent_alerts
  const schedule = status.launchd_schedule

  // 14 天直方图数据
  const chartData = useMemo(
    () =>
      status.instructions_by_date.slice(-14).map((d) => ({
        date: d.date.slice(5),
        total: d.total,
      })),
    [status.instructions_by_date],
  )
  const maxCount = Math.max(1, ...chartData.map((d) => d.total))

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 className="page">引擎状态</h1>
          <div className="sub">
            实时心跳 · launchd 下次触发 · 14 天信号量 · 最近告警
          </div>
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--graphite-500)",
            textAlign: "right",
            fontFamily: "var(--font-mono)",
          }}
        >
          <div>
            服务器时间 {fmtMMDDHHMM(status.server_time)}（{status.server_timezone}）
          </div>
          <div>
            {pollError ? (
              <span style={{ color: "var(--pnl-neg)" }}>轮询失败：{pollError}</span>
            ) : (
              <>
                上次刷新 {fmtRelativePast(new Date(refreshedAt).toISOString(), now)} · 每
                30 秒自动刷新
              </>
            )}
          </div>
        </div>
      </div>

      <div className="kpis" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        <div className="kpi">
          <div className="l">引擎心跳</div>
          <div className="v" style={{ fontSize: 15 }}>
            {state
              ? `${state.session_date} · ${state.session === "day" ? "日盘" : "夜盘"}`
              : "无快照"}
          </div>
          <div className="m">
            {state ? (
              <>
                持仓 {state.state_positions_count} · state{" "}
                {fmtBytes(state.state_bytes)} · 写入于{" "}
                <span className="pos">{fmtRelativePast(state.created_at, now)}</span>
              </>
            ) : (
              "engine_states 表为空"
            )}
          </div>
        </div>
        <div className="kpi">
          <div className="l">今日信号</div>
          <div className="v">{todayTotal}</div>
          <div className="m">
            {todayTotal === 0
              ? "今日暂无指令"
              : Object.entries(todayBreakdown)
                  .map(([k, v]) => `${k} ${v}`)
                  .join(" · ")}
          </div>
        </div>
        <div className="kpi">
          <div className="l">近 7 天累计</div>
          <div className="v">{sevenDayTotal}</div>
          <div className="m">过去 7 个交易日</div>
        </div>
        <div className="kpi">
          <div className="l">24h 告警</div>
          <div className="v">{totalAlerts24h}</div>
          <div className="m">
            info {alertCount.info} · warn {alertCount.warn} · crit {alertCount.critical}
          </div>
        </div>
        <div className="kpi">
          <div className="l">下次触发</div>
          <div className="v" style={{ fontSize: 18 }}>
            {nextSlot ? fmtCountdown(new Date(nextSlot.next_fire).getTime() - now) : "无"}
          </div>
          <div className="m">
            {nextSlot
              ? `${nextSlot.description} · ${fmtMMDDHHMM(nextSlot.next_fire)}`
              : "无 launchd 计划"}
          </div>
        </div>
      </div>

      {/* 账户快照 —— 次要卡片 */}
      {capital && (
        <div className="card-va" style={{ marginTop: 16 }}>
          <div className="hd">
            <div className="ti">账户快照 · {capital.date}</div>
            <div className="de">
              权益 <b>{fmtY(toNum(capital.equity) ?? 0)}</b> · 现金{" "}
              {fmtY(toNum(capital.cash) ?? 0)} · 持仓市值{" "}
              {fmtY(toNum(capital.open_positions_mv) ?? 0)} · 回撤{" "}
              <span className="neg">
                {((toNum(capital.drawdown_from_peak) ?? 0) * 100).toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 14 天指令直方图 */}
      <div className="card-va" style={{ marginTop: 16 }}>
        <div className="hd">
          <div className="ti">近 14 天指令数</div>
          <div className="de">信号产出节奏 · 日盘 + 夜盘合计</div>
        </div>
        <div className="bd" style={{ height: 150, padding: "0 16px 8px" }}>
          {chartData.length === 0 ? (
            <div
              style={{
                padding: 16,
                color: "var(--graphite-500)",
                fontSize: 12,
              }}
            >
              无指令产出记录
            </div>
          ) : (
            <svg className="chart-surface" viewBox="0 0 780 130" preserveAspectRatio="none">
              {chartData.map((d, i) => {
                const bw = (780 / chartData.length) * 0.58
                const x = (i + 0.5) * (780 / chartData.length) - bw / 2
                const h = (d.total / maxCount) * 100
                return (
                  <g key={i}>
                    <rect
                      className="chart-bar"
                      x={x}
                      y={108 - h}
                      width={bw}
                      height={h}
                      fill="var(--mist)"
                      rx="2"
                    />
                    <text className="chart-axis" x={x + bw / 2} y={124} textAnchor="middle">
                      {d.date}
                    </text>
                  </g>
                )
              })}
            </svg>
          )}
        </div>
      </div>

      {/* launchd 计划 */}
      <div className="card-va" style={{ marginTop: 16 }}>
        <div className="hd">
          <div className="ti">launchd 触发计划</div>
          <div className="de">
            共 {schedule.length} 个时点 · 从 live/scheduler/*.plist 解析
          </div>
        </div>
        <div className="bd" style={{ padding: 0 }}>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th style={{ paddingLeft: 16 }}>Label</th>
                  <th>说明</th>
                  <th className="ta-r">触发时刻</th>
                  <th className="ta-r">下次触发</th>
                  <th className="ta-r" style={{ paddingRight: 16 }}>
                    倒计时
                  </th>
                </tr>
              </thead>
              <tbody>
                {schedule.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        textAlign: "center",
                        color: "var(--graphite-500)",
                        padding: "32px 12px",
                      }}
                    >
                      无 launchd 计划
                    </td>
                  </tr>
                )}
                {schedule.map((slot, idx) => {
                  const ms = new Date(slot.next_fire).getTime() - now
                  const isNext = idx === 0
                  return (
                    <tr
                      key={`${slot.label}-${slot.hour}-${slot.minute}`}
                      style={
                        isNext ? { background: "var(--porcelain-50)" } : undefined
                      }
                    >
                      <td
                        className="num"
                        style={{ paddingLeft: 16, fontSize: 11 }}
                      >
                        {slot.label.replace(/^com\.stockfuture\./, "")}
                      </td>
                      <td>{slot.description}</td>
                      <td className="ta-r num">{fmtHHMM(slot.next_fire)}</td>
                      <td className="ta-r num flat">{fmtMMDDHHMM(slot.next_fire)}</td>
                      <td
                        className="ta-r num"
                        style={{
                          paddingRight: 16,
                          fontWeight: isNext ? 500 : 400,
                        }}
                      >
                        {fmtCountdown(ms)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 最近告警 */}
      <div className="card-va" style={{ marginTop: 16 }}>
        <div className="hd">
          <div className="ti">最近告警</div>
          <div className="de">最近 {recentAlerts.length} 条事件</div>
        </div>
        <div
          className="bd"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            padding: "4px 16px 16px",
          }}
        >
          {recentAlerts.length === 0 && (
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
          {recentAlerts.map((a, i) => (
            <div
              key={a.id}
              style={{
                display: "flex",
                gap: 8,
                paddingTop: 10,
                borderTop: i ? "1px solid var(--porcelain-100)" : "none",
              }}
            >
              <SevPill sev={a.severity} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, lineHeight: 1.4 }}>{a.message}</div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--graphite-500)",
                    marginTop: 3,
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {fmtMMDDHHMM(a.event_at)} · {a.event_type}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          fontSize: 11,
          color: "var(--graphite-500)",
          paddingTop: 12,
          fontFamily: "var(--font-mono)",
        }}
      >
        DB 健康：
        <b className={status.db_health === "ok" ? "pos" : "neg"}>{status.db_health}</b>
      </div>
    </>
  )
}
