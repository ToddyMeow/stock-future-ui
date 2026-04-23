"use client"

/**
 * Alpha Lab · Artifacts 落地页 —— 未选 run 时展示 completed runs。
 */
import { useEffect, useState } from "react"
import Link from "next/link"
import { listExperimentRunsClient } from "@/lib/api"
import type { ExperimentRunSummary } from "@/lib/types"

export function ArtifactsLandingView() {
  const [runs, setRuns] = useState<ExperimentRunSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listExperimentRunsClient()
      .then((data) => setRuns(data.filter((r) => !r.is_archived)))
      .catch(() => setRuns([]))
      .finally(() => setLoading(false))
  }, [])

  const completed = runs
    .filter((r) => r.status === "completed")
    .slice(0, 20)
    .sort(
      (a, b) =>
        new Date(b.completed_at ?? b.started_at).getTime() -
        new Date(a.completed_at ?? a.started_at).getTime(),
    )

  return (
    <>
      <div className="exp1-head">
        <div>
          <div className="eye">实验工件</div>
          <h1>挑选一个 completed run 查看候选组合与验证结论</h1>
          <div className="sub">
            共 {completed.length} 个已完成 run · 以 phase3_group_candidates 为主要展示
          </div>
        </div>
      </div>

      <div className="exp1-card">
        <div className="ti-row">
          <div className="ti">Completed Runs</div>
          <Link href="/alpha-lab/runs" className="btn-ghost">
            查看全部 →
          </Link>
        </div>
        {loading && (
          <div style={{ color: "var(--graphite-500)", padding: 8 }}>加载中…</div>
        )}
        {!loading && completed.length === 0 && (
          <div style={{ color: "var(--graphite-500)", padding: 8 }}>
            暂无已完成 run ·{" "}
            <Link href="/alpha-lab" style={{ color: "var(--graphite-700)" }}>
              前往启动台 →
            </Link>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
          {completed.map((r) => (
            <Link
              key={r.run_id}
              href={`/alpha-lab/runs/${encodeURIComponent(r.run_id)}/artifacts`}
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
                <span className="pill filled">
                  <span className="dot" />
                  completed
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
