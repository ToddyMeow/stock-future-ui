"use client"

/**
 * app/engine-status/engine-status-view.client.tsx — 引擎状态页
 *
 * 布局：
 *   - 顶部 6 张 Card（Engine 心跳 / 今日信号 / 本周累计 / 最近告警 / 下次触发 / 账户快照）
 *   - 中部折线图（过去 14 天每日指令数）
 *   - 下部表格：8 条 launchd 触发点 + 倒计时
 *   - 底部：最近 10 条告警
 *
 * 刷新：首屏用 RSC props 渲染；每 30 秒 fetch 一次更新，无抖动。
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { SeverityBadge } from "@/components/status-badges"
import { fetchEngineStatus } from "@/lib/api"
import { formatCurrency } from "@/lib/mock"
import type { EngineStatus, LaunchdSlot } from "@/lib/types"

const REFRESH_MS = 30_000 // 30 秒自动刷新

// ---------- 格式化工具 ----------

/** "2026-04-20T02:50:00+08:00" → "02:50"。 */
function fmtHHMM(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

/** "2026-04-20T02:50:00+08:00" → "04-20 02:50"。 */
function fmtMMDDHHMM(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

/** 毫秒数 → "2h 15m"（超过 24h 则显示 "1d 3h"）。 */
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

/** ISO → "X 小时前 / X 天前 / 刚刚"。 */
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

/** bytes → 可读（KB / MB）。 */
function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

/** Decimal string → number（后端可能给字符串）。 */
function toNum(v: number | string | null | undefined): number {
  if (v == null) return 0
  return typeof v === "number" ? v : Number(v)
}

export function EngineStatusView({ initial }: { initial: EngineStatus }) {
  const [status, setStatus] = useState<EngineStatus>(initial)
  const [refreshedAt, setRefreshedAt] = useState<number>(Date.now())
  const [now, setNow] = useState<number>(Date.now())
  const [pollError, setPollError] = useState<string | null>(null)

  // 30s 轮询更新 status
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

  // 1s 本地时钟，用于倒计时 / "距今多久"（无需再打后端）
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // --- 派生数据 ---

  const today = status.instructions_by_date[status.instructions_by_date.length - 1]
  const todayTotal = today?.total ?? 0
  const todayBreakdown = today?.by_status ?? {}

  const sevenDayTotal = useMemo(
    () =>
      status.instructions_by_date
        .slice(-7)
        .reduce((acc, d) => acc + d.total, 0),
    [status.instructions_by_date],
  )

  const alertCount = status.alerts_24h_count
  const totalAlerts24h =
    (alertCount?.info ?? 0) + (alertCount?.warn ?? 0) + (alertCount?.critical ?? 0)

  const nextSlot: LaunchdSlot | null =
    status.launchd_schedule.find((s) => new Date(s.next_fire).getTime() > now) ??
    status.launchd_schedule[0] ??
    null

  const chartData = useMemo(
    () =>
      status.instructions_by_date.map((d) => ({
        date: d.date.slice(5), // MM-DD
        total: d.total,
      })),
    [status.instructions_by_date],
  )

  const state = status.latest_state
  const capital = status.capital_snapshot

  // 最近告警（后端已给最多 10 条）
  const recentAlerts = status.recent_alerts

  // 标签行 —— 倒计时 8-10 条全部展示（后端已按时间排序）
  const schedule = status.launchd_schedule

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">引擎状态</h1>
          <p className="text-sm text-muted-foreground mt-1">
            实时引擎心跳 · launchd 下次触发 · 14 天信号量 · 最近告警
          </p>
        </div>
        <div className="text-xs text-muted-foreground text-right shrink-0">
          <div>
            服务器时间 {fmtMMDDHHMM(status.server_time)}（{status.server_timezone}）
          </div>
          <div>
            {pollError ? (
              <span className="text-red-500">轮询失败：{pollError}</span>
            ) : (
              <>上次刷新 {fmtRelativePast(new Date(refreshedAt).toISOString(), now)} · 每 30 秒自动刷新</>
            )}
          </div>
        </div>
      </div>

      {/* 顶部 6 张 Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
        {/* Card 1: Engine 心跳 */}
        <Card>
          <CardHeader>
            <CardDescription>引擎心跳</CardDescription>
            <CardTitle className="text-lg font-semibold">
              {state
                ? `${state.session_date} ${state.session === "day" ? "日盘" : "夜盘"}`
                : "无快照"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {state ? (
              <>
                <p className="text-xs text-muted-foreground">
                  state.last_date = <b>{state.state_last_date ?? "N/A"}</b>
                </p>
                <p className="text-xs text-muted-foreground">
                  持仓 {state.state_positions_count} 只 · state{" "}
                  {fmtBytes(state.state_bytes)}
                </p>
                <p className="text-xs text-muted-foreground">
                  写入于 {fmtRelativePast(state.created_at, now)}
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                engine_states 表为空（引擎尚未首次 warmup）
              </p>
            )}
          </CardContent>
        </Card>

        {/* Card 2: 今日信号 */}
        <Card>
          <CardHeader>
            <CardDescription>今日信号</CardDescription>
            <CardTitle className="text-2xl font-bold">{todayTotal}</CardTitle>
          </CardHeader>
          <CardContent>
            {todayTotal === 0 ? (
              <p className="text-xs text-muted-foreground">今日暂无指令</p>
            ) : (
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {Object.entries(todayBreakdown).map(([k, v]) => (
                  <span key={k}>
                    {k}: <b className="text-foreground">{v}</b>
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 3: 本周累计 */}
        <Card>
          <CardHeader>
            <CardDescription>近 7 天累计</CardDescription>
            <CardTitle className="text-2xl font-bold">{sevenDayTotal}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">过去 7 个交易日指令总数</p>
          </CardContent>
        </Card>

        {/* Card 4: 最近告警 24h */}
        <Card>
          <CardHeader>
            <CardDescription>24 小时告警</CardDescription>
            <CardTitle className="text-2xl font-bold">{totalAlerts24h}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 text-xs">
              <span className="text-blue-600 dark:text-blue-300">
                info <b>{alertCount.info}</b>
              </span>
              <span className="text-yellow-600 dark:text-yellow-300">
                warn <b>{alertCount.warn}</b>
              </span>
              <span className="text-red-600 dark:text-red-300">
                critical <b>{alertCount.critical}</b>
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 5: 下次触发倒计时 */}
        <Card>
          <CardHeader>
            <CardDescription>下次触发</CardDescription>
            <CardTitle className="text-2xl font-bold">
              {nextSlot
                ? fmtCountdown(new Date(nextSlot.next_fire).getTime() - now)
                : "无"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {nextSlot ? (
              <p className="text-xs text-muted-foreground">
                {nextSlot.description}
                <br />
                {fmtMMDDHHMM(nextSlot.next_fire)}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">无 launchd 计划</p>
            )}
          </CardContent>
        </Card>

        {/* Card 6: 账户快照 */}
        <Card>
          <CardHeader>
            <CardDescription>账户快照</CardDescription>
            <CardTitle className="text-lg font-semibold">
              {capital ? formatCurrency(toNum(capital.equity)) : "暂无日结"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {capital ? (
              <>
                <p className="text-xs text-muted-foreground">
                  现金 {formatCurrency(toNum(capital.cash))} · 持仓市值{" "}
                  {formatCurrency(toNum(capital.open_positions_mv))}
                </p>
                <p className="text-xs text-muted-foreground">
                  回撤{" "}
                  {(toNum(capital.drawdown_from_peak) * 100).toFixed(2)}% ·{" "}
                  {capital.date}
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">daily_pnl 表无数据</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 中部：折线图（14 天每日指令数） */}
      <Card>
        <CardHeader>
          <CardTitle>近 14 天指令数</CardTitle>
          <CardDescription>
            每天由 signal_service 日 / 夜盘两次触发产出
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  opacity={0.1}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  stroke="currentColor"
                  opacity={0.5}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="currentColor"
                  opacity={0.5}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelFormatter={(l) => `日期 ${l}`}
                  formatter={(v) => [v, "指令数"]}
                />
                <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* launchd 触发表 */}
      <Card>
        <CardHeader>
          <CardTitle>launchd 触发计划</CardTitle>
          <CardDescription>
            共 {schedule.length} 个时点 · 从 live/scheduler/*.plist 解析
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>说明</TableHead>
                <TableHead>触发时刻</TableHead>
                <TableHead>下次触发</TableHead>
                <TableHead className="text-right">倒计时</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedule.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    无 launchd 计划
                  </TableCell>
                </TableRow>
              )}
              {schedule.map((slot, idx) => {
                const ms = new Date(slot.next_fire).getTime() - now
                const isNext = idx === 0 // 后端按 next_fire 升序
                return (
                  <TableRow
                    key={`${slot.label}-${slot.hour}-${slot.minute}`}
                    className={isNext ? "bg-muted/30" : ""}
                  >
                    <TableCell className="font-mono text-xs">
                      {slot.label.replace(/^com\.stockfuture\./, "")}
                    </TableCell>
                    <TableCell>{slot.description}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {fmtHHMM(slot.next_fire)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {fmtMMDDHHMM(slot.next_fire)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {fmtCountdown(ms)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 最近告警 */}
      <Card>
        <CardHeader>
          <CardTitle>最近告警</CardTitle>
          <CardDescription>最近 10 条 alerts 表事件</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentAlerts.length === 0 && (
            <p className="text-xs text-muted-foreground">暂无告警</p>
          )}
          {recentAlerts.map((a, i) => (
            <div key={a.id}>
              <div className="flex items-start gap-2">
                <SeverityBadge severity={a.severity} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug">{a.message}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {fmtMMDDHHMM(a.event_at)} · {a.event_type}
                  </p>
                </div>
              </div>
              {i < recentAlerts.length - 1 && <Separator className="mt-3" />}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground pt-2">
        DB 健康：<b className={status.db_health === "ok" ? "text-green-600" : "text-red-600"}>{status.db_health}</b>
      </div>
    </div>
  )
}
