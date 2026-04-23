"use client"

/**
 * Alpha Lab · 运行列表 / Sweep 状态（V1 canonical）
 *
 * 数据：listExperimentRunsClient 返回全部 runs（含归档）。
 * 展示：顶部 sweep-bar 聚合按状态比例；下方表格 run 详情。
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { listExperimentRunsClient } from "@/lib/api"
import type { ExperimentRunStatus, ExperimentRunSummary } from "@/lib/types"

const POLL_MS = 5_000

const STATUS_LABEL: Record<ExperimentRunStatus, string> = {
  queued: "queued",
  running: "running",
  completed: "completed",
  failed: "failed",
  interrupted: "interrupted",
}
const STATUS_PILL: Record<ExperimentRunStatus, string> = {
  queued: "pending",
  running: "partial",
  completed: "filled",
  failed: "vetoed",
  interrupted: "skipped",
}

function fmtClock(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(11, 16)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

function currentPhase(run: ExperimentRunSummary): string {
  const prog = run.capital_progress.find((c) => c.current_phase_label)
  if (prog) {
    const pct = prog.progress_percent != null ? ` ${prog.progress_percent.toFixed(0)}%` : ""
    const phase = prog.current_phase?.replace("phase", "P") ?? "—"
    return run.status === "completed" ? `${phase} ✓` : `${phase}${pct}`
  }
  return run.status === "completed" ? "P5 ✓" : "P0"
}

function capToken(caps: number[]): string {
  return caps
    .map((c) => (c % 1_000_000 === 0 ? `${c / 1_000_000}m` : `${c / 1000}k`))
    .join("+")
}

export function RunsView() {
  const [runs, setRuns] = useState<ExperimentRunSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await listExperimentRunsClient()
      setRuns(data.filter((r) => !r.is_archived))
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, POLL_MS)
    return () => clearInterval(id)
  }, [load])

  const counts = useMemo(() => {
    const c = { running: 0, queued: 0, completed: 0, failed: 0, interrupted: 0 }
    for (const r of runs) c[r.status]++
    return c
  }, [runs])

  const total = runs.length || 1
  const pct = (n: number) => `${Math.round((n / total) * 100)}%`

  const runningCount = counts.running
  const etaRun = runs.find((r) => r.status === "running")
  const etaLabel = (() => {
    if (!etaRun) return ""
    const prog = etaRun.capital_progress.find((c) => c.progress_percent != null)
    if (!prog || prog.progress_percent == null) return ""
    return ` · 预计剩余 ~${Math.round((100 - prog.progress_percent) * 1.8)} 分钟`
  })()

  return (
    <>
      <div className="exp1-head">
        <div>
          <div className="eye">
            {runningCount > 0
              ? `运行中 · ${etaRun?.run_name ?? ""}`
              : "Sweep Run Registry"}
          </div>
          <h1>
            {runs.length} / {runs.length} runs · {runningCount} running
          </h1>
          <div className="sub">
            全部 runs · 按启动时间倒序 · 每 5 秒自动刷新{etaLabel}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn-exp" onClick={load} disabled={loading}>
            刷新
          </button>
        </div>
      </div>

      {err && (
        <div
          className="exp1-card"
          style={{
            marginBottom: 14,
            background: "var(--pnl-neg-soft)",
            borderColor: "var(--pnl-neg)",
            color: "var(--pnl-neg)",
          }}
        >
          加载失败：{err}
        </div>
      )}

      <div className="sweep-bar">
        <div className="bar-row">
          <span className="lbl">running</span>
          <div className="b run" style={{ width: pct(counts.running) }} />
          <span className="cnt">{counts.running}</span>
        </div>
        <div className="bar-row">
          <span className="lbl">queued</span>
          <div className="b que" style={{ width: pct(counts.queued) }} />
          <span className="cnt">{counts.queued}</span>
        </div>
        <div className="bar-row">
          <span className="lbl">completed</span>
          <div className="b ok" style={{ width: pct(counts.completed) }} />
          <span className="cnt">{counts.completed}</span>
        </div>
        <div className="bar-row">
          <span className="lbl">failed</span>
          <div className="b bad" style={{ width: pct(counts.failed) }} />
          <span className="cnt">{counts.failed}</span>
        </div>
      </div>

      <div className="exp1-card" style={{ marginTop: 14, padding: 0 }}>
        <div className="ti-row" style={{ padding: "12px 16px 0" }}>
          <div className="ti">Sweep Runs</div>
          <div style={{ fontSize: 11, color: "var(--graphite-500)" }}>按启动顺序</div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="run-table">
            <thead>
              <tr>
                <th style={{ paddingLeft: 16 }}>Run</th>
                <th>Sweep</th>
                <th>Capitals</th>
                <th>Phase</th>
                <th>Started</th>
                <th>Status</th>
                <th style={{ paddingRight: 16 }} />
              </tr>
            </thead>
            <tbody>
              {loading && runs.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      textAlign: "center",
                      color: "var(--graphite-500)",
                      padding: "40px 12px",
                    }}
                  >
                    加载中…
                  </td>
                </tr>
              )}
              {!loading && runs.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      textAlign: "center",
                      color: "var(--graphite-500)",
                      padding: "40px 12px",
                    }}
                  >
                    暂无 run ·{" "}
                    <Link
                      href="/alpha-lab"
                      style={{ color: "var(--graphite-700)" }}
                    >
                      前往启动台
                    </Link>
                  </td>
                </tr>
              )}
              {runs.map((r) => (
                <tr key={r.run_id} className={r.status === "running" ? "on" : ""}>
                  <td style={{ paddingLeft: 16 }}>
                    <div className="r-name">{r.run_name}</div>
                    <div className="r-id">{r.run_id.slice(0, 28)}…</div>
                  </td>
                  <td className="num flat">
                    {r.sweep?.member_label ?? "—"}
                  </td>
                  <td className="num">{capToken(r.capitals)}</td>
                  <td>
                    <span className={`phase-chip ${r.status}`}>
                      {currentPhase(r)}
                    </span>
                  </td>
                  <td className="num flat">{fmtClock(r.started_at)}</td>
                  <td>
                    <span className={`pill ${STATUS_PILL[r.status]}`}>
                      <span className="dot" />
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td className="ta-r" style={{ paddingRight: 16 }}>
                    <Link
                      href={`/alpha-lab/runs/${encodeURIComponent(r.run_id)}`}
                      className="btn-ghost"
                    >
                      detail →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
