"use client"

/**
 * Alpha Lab · Artifacts View
 *
 * 顶部 tab 切换 P0–P5 + 平台验证；下方展示候选组合表。
 * MVP：默认展示 phase3_group_candidates（Phase 3），其余 phase 走相同接口切换。
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  fetchExperimentArtifactClient,
  fetchExperimentPhaseSummaryClient,
  fetchExperimentRunClient,
} from "@/lib/api"
import { fmtPct, signCls } from "@/lib/format"
import type {
  ExperimentArtifactResponse,
  ExperimentPhaseSummaryResponse,
  ExperimentRunDetail,
} from "@/lib/types"

const PHASES: Array<{ key: string; label: string; artifact: string }> = [
  { key: "phase0", label: "P0", artifact: "universe" },
  { key: "phase1", label: "P1", artifact: "groups" },
  { key: "phase2", label: "P2", artifact: "symbol_scoring" },
  { key: "phase3", label: "P3", artifact: "group_candidates" },
  { key: "phase4", label: "P4", artifact: "rolling_selection" },
  { key: "phase5", label: "P5", artifact: "risk_cells" },
]

type Row = Record<string, unknown>

function toNum(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === "number") return Number.isFinite(v) ? v : null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function pickSharpe(row: Row): number | null {
  return toNum(row.sharpe ?? row.sharpe_median ?? row.sharpe_mean)
}
function pickCAGR(row: Row): number | null {
  return toNum(row.cagr ?? row.cagr_mean ?? row.cagr_median)
}
function pickDD(row: Row): number | null {
  return toNum(row.max_drawdown ?? row.maxdd ?? row.dd)
}
function pickWin(row: Row): number | null {
  return toNum(row.win_rate ?? row.winrate)
}
function pickStability(row: Row): string {
  const label = row.stability ?? row.stability_label ?? row.label
  if (typeof label === "string") return label
  const v = toNum(row.stability)
  if (v == null) return "—"
  if (v > 0.7) return "stable"
  if (v > 0.5) return "marginal"
  return "unstable"
}
function pickId(row: Row, fallback: number): string {
  return String(row.group_id ?? row.id ?? row.combo ?? `G-${fallback}`)
}
function pickSymbols(row: Row): string {
  const s = row.symbols ?? row.members ?? row.group
  if (Array.isArray(s)) return s.join(" · ")
  if (typeof s === "string") return s
  return "—"
}

export function ArtifactsView({ runId }: { runId: string }) {
  const [phase, setPhase] = useState<string>("phase3")
  const [run, setRun] = useState<ExperimentRunDetail | null>(null)
  const [caps, setCaps] = useState<string>("")
  const [rows, setRows] = useState<Row[]>([])
  const [summary, setSummary] = useState<ExperimentPhaseSummaryResponse | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // 初始化：拉 run 以得到 capital 列表
  useEffect(() => {
    fetchExperimentRunClient(runId)
      .then((r) => {
        setRun(r)
        const firstCap = r.capitals[0]
        if (firstCap) setCaps(String(firstCap))
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
  }, [runId])

  const loadArtifact = useCallback(async () => {
    if (!caps) return
    setLoading(true)
    try {
      const ph = PHASES.find((p) => p.key === phase)
      if (!ph) return
      const resp: ExperimentArtifactResponse = await fetchExperimentArtifactClient({
        runId,
        capital: caps,
        phase: ph.key,
        artifact: ph.artifact,
        limit: 100,
      })
      setRows(resp.rows)
      // 平台验证摘要（phase3 才拿）
      if (phase === "phase3") {
        try {
          const s = await fetchExperimentPhaseSummaryClient({
            runId,
            capital: caps,
            phase: "phase3",
          })
          setSummary(s)
        } catch {
          setSummary(null)
        }
      } else {
        setSummary(null)
      }
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [runId, caps, phase])

  useEffect(() => {
    loadArtifact()
  }, [loadArtifact])

  const verdict = useMemo(() => {
    const raw = summary?.summary ?? {}
    return {
      verdict: String((raw as Row).verdict ?? (raw as Row).platform_verdict ?? "—"),
      members: String(
        (raw as Row).picked_groups ??
          (raw as Row).selected_groups ??
          (raw as Row).members ??
          "—",
      ),
      stability:
        String(
          (raw as Row).stability_summary ??
            (raw as Row).exit_probabilities ??
            "stable / stable / marginal",
        ) || "—",
      next: String((raw as Row).next_phase ?? "P4 rolling_select (queued)"),
    }
  }, [summary])

  if (err && !run) {
    return (
      <>
        <div className="exp1-head">
          <div>
            <div className="eye">Error</div>
            <h1>无法加载 run</h1>
            <div className="sub">{err}</div>
          </div>
          <Link href="/alpha-lab/runs" className="btn-exp">
            ← 返回运行列表
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="exp1-head">
        <div>
          <div className="eye">
            {run?.run_name ?? runId.slice(0, 24)}
            {run?.status === "completed" ? " · completed" : ` · ${run?.status ?? ""}`}
          </div>
          <h1>
            {PHASES.find((p) => p.key === phase)?.label ?? "P?"} · 实验工件
          </h1>
          <div className="sub">
            phase artifact = <code>{PHASES.find((p) => p.key === phase)?.artifact}</code>{" "}
            · {rows.length} 行
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {run && run.capitals.length > 1 && (
            <div className="seg">
              {run.capitals.map((c) => (
                <button
                  key={c}
                  className={String(c) === caps ? "on" : ""}
                  onClick={() => setCaps(String(c))}
                >
                  {c % 1_000_000 === 0
                    ? `${c / 1_000_000}m`
                    : `${c / 1000}k`}
                </button>
              ))}
            </div>
          )}
          <Link
            href={`/alpha-lab/runs/${encodeURIComponent(runId)}`}
            className="btn-exp"
          >
            ← 返回 Phase
          </Link>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        <div className="seg">
          {PHASES.map((p) => (
            <button
              key={p.key}
              className={p.key === phase ? "on" : ""}
              onClick={() => setPhase(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button className="btn-exp" onClick={loadArtifact} disabled={loading}>
          {loading ? "加载中…" : "刷新"}
        </button>
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
          artifact 加载失败：{err}
        </div>
      )}

      <div className="exp1-card" style={{ padding: 0 }}>
        <div style={{ overflowX: "auto" }}>
          <table className="art-table">
            <thead>
              <tr>
                <th style={{ paddingLeft: 16 }}>组 ID</th>
                <th>品种</th>
                <th className="ta-r">Sharpe</th>
                <th className="ta-r">CAGR</th>
                <th className="ta-r">MaxDD</th>
                <th className="ta-r">胜率</th>
                <th style={{ paddingRight: 16 }}>结论</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      textAlign: "center",
                      color: "var(--graphite-500)",
                      padding: "40px 12px",
                    }}
                  >
                    该 phase 暂无 artifact（或后端未产出）
                  </td>
                </tr>
              )}
              {rows.map((r, i) => {
                const sharpe = pickSharpe(r)
                const cagr = pickCAGR(r)
                const dd = pickDD(r)
                const win = pickWin(r)
                const stab = pickStability(r)
                const pill =
                  stab === "stable"
                    ? "filled"
                    : stab === "marginal"
                      ? "partial"
                      : "vetoed"
                return (
                  <tr key={i}>
                    <td className="mono" style={{ paddingLeft: 16 }}>
                      {pickId(r, i + 1)}
                    </td>
                    <td className="mono muted">{pickSymbols(r)}</td>
                    <td className={`ta-r mono ${sharpe != null && sharpe >= 1 ? "pos" : ""}`}>
                      {sharpe != null ? sharpe.toFixed(2) : "—"}
                    </td>
                    <td className={`ta-r mono ${signCls(cagr)}`}>
                      {cagr != null ? fmtPct(cagr, 0) : "—"}
                    </td>
                    <td className="ta-r mono neg">
                      {dd != null ? fmtPct(dd, 0) : "—"}
                    </td>
                    <td className="ta-r mono">
                      {win != null ? fmtPct(win, 0) : "—"}
                    </td>
                    <td style={{ paddingRight: 16 }}>
                      <span className={`pill ${pill}`}>
                        <span className="dot" />
                        {stab === "stable"
                          ? "稳定"
                          : stab === "marginal"
                            ? "边际"
                            : stab === "unstable"
                              ? "不稳定"
                              : stab}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {phase === "phase3" && (
        <div className="art-summary">
          <div>
            <span className="eye">平台验证结论</span>
            <div
              className="n pos"
              style={{ fontSize: 20, textTransform: "none" }}
            >
              {verdict.verdict}
            </div>
          </div>
          <div>
            <span className="eye">选中组合</span>
            <div className="n">{verdict.members}</div>
          </div>
          <div>
            <span className="eye">下一步</span>
            <div className="n">{verdict.next}</div>
          </div>
        </div>
      )}
    </>
  )
}
