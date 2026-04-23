"use client"

/**
 * Alpha Lab · Phase Tracker（单 run · 双资本栏）
 *
 * 数据：fetchExperimentRunClient(runId) → ExperimentRunDetail.capital_progress。
 * 设计：左右两个 cap-col，每列 Phase 0–5 + 平台验证 7 行列表。
 */
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { fetchExperimentRunClient } from "@/lib/api"
import type {
  ExperimentCapitalProgress,
  ExperimentRunDetail,
  ExperimentPhaseProgress,
} from "@/lib/types"

const POLL_MS = 4_000

function capLabel(n: number): string {
  if (n % 1_000_000 === 0) return `${n / 1_000_000} 百万 · ${n / 10000} 万`
  if (n % 10_000 === 0) return `${n / 10_000} 万`
  return n.toLocaleString("zh-CN")
}

function statusToClass(
  p: ExperimentPhaseProgress,
  cap: ExperimentCapitalProgress,
): string {
  if (p.status === "completed") return "done"
  if (p.status === "running" || (p.is_current && cap.current_phase === p.phase))
    return "running"
  if (p.status === "pending") return "queued"
  return "queued"
}

function overallStatusPill(cap: ExperimentCapitalProgress) {
  if (!cap.current_phase)
    return (
      <span className="pill filled">
        <span className="dot" />
        completed
      </span>
    )
  const phase = cap.current_phase.replace("phase", "P")
  return (
    <span className="pill partial">
      <span className="dot" />
      {phase} running
    </span>
  )
}

export function PhaseTrackerView({ runId }: { runId: string }) {
  const [run, setRun] = useState<ExperimentRunDetail | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const r = await fetchExperimentRunClient(runId)
      setRun(r)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [runId])

  useEffect(() => {
    load()
    const id = setInterval(load, POLL_MS)
    return () => clearInterval(id)
  }, [load])

  if (loading && !run) {
    return (
      <>
        <div className="exp1-head">
          <div>
            <div className="eye">加载中</div>
            <h1>Phase Tracker</h1>
            <div className="sub">正在加载 run 详情…</div>
          </div>
        </div>
      </>
    )
  }

  if (err || !run) {
    return (
      <>
        <div className="exp1-head">
          <div>
            <div className="eye">Error</div>
            <h1>无法加载 run</h1>
            <div className="sub">{err ?? "unknown"}</div>
          </div>
          <Link href="/alpha-lab/runs" className="btn-exp">
            ← 返回运行列表
          </Link>
        </div>
      </>
    )
  }

  const sweepLabel = run.sweep?.member_label ?? "—"

  return (
    <>
      <div className="exp1-head">
        <div>
          <div className="eye">
            {run.run_name} · {sweepLabel}
          </div>
          <h1>Phase Tracker · {run.capitals.map(capLabel).join(" + ")}</h1>
          <div className="sub">
            run_id <code>{run.run_id.slice(0, 32)}…</code> · 状态 {run.status}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Link href="/alpha-lab/runs" className="btn-exp">
            ← 运行列表
          </Link>
          <Link
            href={`/alpha-lab/runs/${encodeURIComponent(runId)}/artifacts`}
            className="btn-exp"
          >
            查看工件 →
          </Link>
        </div>
      </div>

      <div
        className="cap-row"
        style={{
          gridTemplateColumns:
            run.capital_progress.length === 1 ? "1fr" : "1fr 1fr",
        }}
      >
        {run.capital_progress.map((cap) => (
          <div key={cap.capital} className="cap-col">
            <div className="cap-h">
              <span className="eye">{capLabel(cap.capital)}</span>
              {overallStatusPill(cap)}
            </div>
            <div className="phase-list">
              {cap.phases.map((p, i) => {
                const cls = statusToClass(p, cap)
                return (
                  <div key={p.phase} className={`phase ${cls}`}>
                    <div className="ph-idx">{i + 1}</div>
                    <div>
                      <div className="ph-label">{p.label}</div>
                      <div className="ph-detail">
                        {cap.current_phase === p.phase &&
                        cap.progress_percent != null ? (
                          <>
                            {cap.progress_completed}/{cap.progress_total} ·{" "}
                            {cap.progress_percent.toFixed(0)}%
                          </>
                        ) : p.has_output ? (
                          "已产出"
                        ) : p.status === "pending" ? (
                          "待启动"
                        ) : (
                          p.status
                        )}
                      </div>
                    </div>
                    <div className={`ph-status ${cls}`}>
                      {cls === "done"
                        ? "✓"
                        : cls === "running"
                          ? "···"
                          : "—"}
                    </div>
                  </div>
                )
              })}
            </div>
            {cap.latest_log && (
              <div
                style={{
                  marginTop: 12,
                  padding: "8px 10px",
                  background: "var(--porcelain-50)",
                  borderRadius: 6,
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  color: "var(--graphite-700)",
                  whiteSpace: "pre-wrap",
                }}
              >
                {cap.latest_log}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
