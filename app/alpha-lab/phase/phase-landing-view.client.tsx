"use client"

/**
 * Alpha Lab · Phase Tracker 落地页 —— 未选 run 时引导用户从列表挑选。
 */
import { useEffect, useState } from "react"
import Link from "next/link"
import { listExperimentRunsClient } from "@/lib/api"
import type { ExperimentRunSummary } from "@/lib/types"

export function PhaseLandingView() {
  const [runs, setRuns] = useState<ExperimentRunSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listExperimentRunsClient()
      .then((data) => setRuns(data.filter((r) => !r.is_archived)))
      .catch(() => setRuns([]))
      .finally(() => setLoading(false))
  }, [])

  const running = runs.filter((r) => r.status === "running")
  const recent = runs
    .slice(0, 10)
    .sort(
      (a, b) =>
        new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
    )

  return (
    <>
      <div className="exp1-head">
        <div>
          <div className="eye">分阶段上线</div>
          <h1>挑选一个 run 查看 Phase Tracker</h1>
          <div className="sub">
            当前 {running.length} 个 running · 近期 {recent.length} 条
          </div>
        </div>
      </div>

      <div className="exp1-card">
        <div className="ti-row">
          <div className="ti">近期 Runs</div>
          <Link href="/alpha-lab/runs" className="btn-ghost">
            查看全部 →
          </Link>
        </div>
        {loading && (
          <div style={{ color: "var(--graphite-500)", padding: 8 }}>加载中…</div>
        )}
        {!loading && recent.length === 0 && (
          <div style={{ color: "var(--graphite-500)", padding: 8 }}>
            暂无 run ·{" "}
            <Link href="/alpha-lab" style={{ color: "var(--graphite-700)" }}>
              前往启动台 →
            </Link>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
          {recent.map((r) => (
            <Link
              key={r.run_id}
              href={`/alpha-lab/runs/${encodeURIComponent(r.run_id)}`}
              className="strat"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                textDecoration: "none",
              }}
            >
              <div>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{r.run_name}</div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--graphite-500)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {r.run_id.slice(0, 36)}…
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span
                  className={`phase-chip ${r.status}`}
                  style={{ textTransform: "none" }}
                >
                  {r.status}
                </span>
                <span style={{ fontSize: 12, color: "var(--graphite-500)" }}>→</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
