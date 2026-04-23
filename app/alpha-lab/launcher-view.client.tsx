"use client"

/**
 * Alpha Lab · 启动台（V1 canonical）
 *
 * UI 结构（对齐设计稿）：
 *   1. 基础设置（Run Name / Suffix / Capitals / Seeds / Bootstrap / Max Workers）
 *   2. Entries 策略选择 + 参数
 *   3. Exits 策略选择 + 参数
 *   4. Sweep 笛卡尔规划 · 预览 · 预计 run 数
 *   5. Fire 区：扩展选项 + 本金/worker 汇总 + Fire 按钮 + 跳转提示
 *
 * 与 /experiments 的差异：极简 MVP — 数据模型 1:1 走真接口，但展示按 V1 设计。
 */
import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  fetchExperimentStrategyCatalogClient,
  launchExperimentClient,
} from "@/lib/api"
import type {
  ExperimentLaunchRequest,
  ExperimentStrategyCatalog,
  ExperimentStrategyDescriptor,
  ExperimentStrategyParameterDescriptor,
} from "@/lib/types"

type StratState = {
  selected: boolean
  params: Record<string, string> // 字符串态，提交时按 value_type 转
}

type CapKey = "both" | "250k" | "1m"
const CAP_PRESETS: Record<CapKey, number[]> = {
  both: [250_000, 1_000_000],
  "250k": [250_000],
  "1m": [1_000_000],
}
const CAP_LABEL: Record<CapKey, string> = {
  both: "25 万 + 100 万",
  "250k": "仅 25 万",
  "1m": "仅 100 万",
}

function parseParamValue(
  desc: ExperimentStrategyParameterDescriptor,
  raw: string,
): string | number | boolean {
  if (desc.value_type === "integer") return Number.parseInt(raw, 10) || 0
  if (desc.value_type === "number") return Number.parseFloat(raw) || 0
  if (desc.value_type === "boolean") return raw === "true" || raw === "1"
  return raw
}

function formatParamValue(v: string | number | boolean | null): string {
  if (v == null) return ""
  if (typeof v === "boolean") return v ? "true" : "false"
  return String(v)
}

export function LauncherView() {
  const router = useRouter()
  const [catalog, setCatalog] = useState<ExperimentStrategyCatalog | null>(null)
  const [catalogError, setCatalogError] = useState<string | null>(null)

  // 基础表单
  const [runName, setRunName] = useState("tsmom-baseline")
  const [outputSuffix, setOutputSuffix] = useState(
    new Date().toISOString().slice(0, 7), // 2026-04
  )
  const [cap, setCap] = useState<CapKey>("both")
  const [seeds, setSeeds] = useState("8")
  const [bootstrap, setBootstrap] = useState("500")
  const [maxWorkers, setMaxWorkers] = useState("6")

  // 策略 / 参数选择
  const [entries, setEntries] = useState<Record<string, StratState>>({})
  const [exits, setExits] = useState<Record<string, StratState>>({})

  // Sweep & extras
  const [sweepEnabled, setSweepEnabled] = useState(true)
  const [extendRun, setExtendRun] = useState(false)
  const [rerunPhases, setRerunPhases] = useState(false)

  const [isFiring, startFire] = useTransition()

  // 初始加载 catalog
  useEffect(() => {
    let cancelled = false
    fetchExperimentStrategyCatalogClient()
      .then((c) => {
        if (cancelled) return
        setCatalog(c)
        const initState = (arr: ExperimentStrategyDescriptor[]) => {
          const m: Record<string, StratState> = {}
          for (const s of arr) {
            const p: Record<string, string> = {}
            for (const pd of s.parameters) p[pd.name] = formatParamValue(pd.value)
            m[s.strategy_id] = { selected: s.default_selected, params: p }
          }
          return m
        }
        setEntries(initState(c.entries))
        setExits(initState(c.exits))
      })
      .catch((err) => {
        setCatalogError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const planCount = useMemo(() => {
    if (!sweepEnabled) return 1
    // MVP：基线 plan 1 条（真 sweep 规划由后端 expand_sweep 做，这里只展示提示）
    return 1
  }, [sweepEnabled])

  const toggleStrat = (kind: "entry" | "exit", id: string) => {
    const update = kind === "entry" ? setEntries : setExits
    update((s) => ({
      ...s,
      [id]: { ...s[id], selected: !s[id]?.selected },
    }))
  }
  const updateParam = (
    kind: "entry" | "exit",
    id: string,
    name: string,
    value: string,
  ) => {
    const update = kind === "entry" ? setEntries : setExits
    update((s) => ({
      ...s,
      [id]: { ...s[id], params: { ...s[id].params, [name]: value } },
    }))
  }

  const onFire = () => {
    if (!catalog) return
    const capitals = CAP_PRESETS[cap]

    const selectedEntries = catalog.entries.filter((e) => entries[e.strategy_id]?.selected)
    const selectedExits = catalog.exits.filter((e) => exits[e.strategy_id]?.selected)
    if (selectedEntries.length === 0) {
      toast.error("至少勾选一个入场策略")
      return
    }
    if (selectedExits.length === 0) {
      toast.error("至少勾选一个出场策略")
      return
    }

    const buildParams = (
      arr: ExperimentStrategyDescriptor[],
      state: Record<string, StratState>,
    ): Record<string, Record<string, string | number | boolean>> => {
      const out: Record<string, Record<string, string | number | boolean>> = {}
      for (const s of arr) {
        if (!state[s.strategy_id]?.selected) continue
        const st = state[s.strategy_id]
        const obj: Record<string, string | number | boolean> = {}
        for (const pd of s.parameters) {
          obj[pd.name] = parseParamValue(pd, st.params[pd.name] ?? "")
        }
        out[s.strategy_id] = obj
      }
      return out
    }

    const payload: ExperimentLaunchRequest = {
      run_name: runName.trim() || "run",
      output_suffix: outputSuffix.trim() || undefined,
      capitals,
      entries: selectedEntries.map((e) => e.strategy_id),
      exits: selectedExits.map((e) => e.strategy_id),
      entry_params: buildParams(catalog.entries, entries),
      exit_params: buildParams(catalog.exits, exits),
      seed_count: Number(seeds) || 8,
      bootstrap_count: Number(bootstrap) || 500,
      max_workers: Number(maxWorkers) || 6,
      rerun_phases: rerunPhases,
      extend_from_run_id: extendRun ? undefined : null, // MVP：extendRun 开关先不提供具体 run_id
    }

    startFire(async () => {
      try {
        const run = await launchExperimentClient(payload)
        toast.success(`已启动：${run.run_name}`, {
          description: `run_id ${run.run_id.slice(0, 24)}… · 跳转运行列表`,
        })
        router.push(`/alpha-lab/runs`)
      } catch (err) {
        toast.error("启动失败", {
          description: err instanceof Error ? err.message : String(err),
        })
      }
    })
  }

  const selectedCount = (m: Record<string, StratState>) =>
    Object.values(m).filter((x) => x?.selected).length

  return (
    <>
      <div className="exp1-head">
        <div>
          <div className="eye">实验平台 · Alpha Lab</div>
          <h1>启动台</h1>
          <div className="sub">
            启动一次 25 万 / 100 万分资本实验 · 勾选策略 · 启用参数调优做笛卡尔扩展
          </div>
        </div>
      </div>

      {catalogError && (
        <div
          className="exp1-card"
          style={{
            marginBottom: 14,
            background: "var(--pnl-neg-soft)",
            borderColor: "var(--pnl-neg)",
            color: "var(--pnl-neg)",
          }}
        >
          catalog 加载失败：{catalogError}
        </div>
      )}

      <div className="exp1-grid">
        {/* 基础设置 */}
        <section className="exp1-card">
          <div className="ti">基础设置</div>
          <div className="form-grid">
            <label>
              <span>Run Name</span>
              <input value={runName} onChange={(e) => setRunName(e.target.value)} />
            </label>
            <label>
              <span>Output Suffix</span>
              <input
                value={outputSuffix}
                onChange={(e) => setOutputSuffix(e.target.value)}
              />
            </label>
            <label>
              <span>Capitals</span>
              <div className="seg">
                {(Object.keys(CAP_PRESETS) as CapKey[]).map((k) => (
                  <button
                    key={k}
                    className={cap === k ? "on" : ""}
                    onClick={() => setCap(k)}
                    type="button"
                  >
                    {CAP_LABEL[k]}
                  </button>
                ))}
              </div>
            </label>
            <label>
              <span>Seeds</span>
              <input value={seeds} onChange={(e) => setSeeds(e.target.value)} />
            </label>
            <label>
              <span>Bootstrap</span>
              <input value={bootstrap} onChange={(e) => setBootstrap(e.target.value)} />
            </label>
            <label>
              <span>Max Workers</span>
              <input value={maxWorkers} onChange={(e) => setMaxWorkers(e.target.value)} />
            </label>
          </div>
        </section>

        {/* Entries */}
        <section className="exp1-card">
          <div className="ti-row">
            <div className="ti">
              策略选择 · Entries
              <span className="c">
                {selectedCount(entries)} / {catalog?.entries.length ?? "—"}
              </span>
            </div>
          </div>
          <div className="strat-list">
            {catalog?.entries.map((e) => {
              const st = entries[e.strategy_id] ?? { selected: false, params: {} }
              return (
                <div key={e.strategy_id} className={`strat ${st.selected ? "on" : ""}`}>
                  <label className="chk">
                    <input
                      type="checkbox"
                      checked={st.selected}
                      onChange={() => toggleStrat("entry", e.strategy_id)}
                    />
                    <span>{e.label}</span>
                  </label>
                  {st.selected && e.parameters.length > 0 && (
                    <div className="params">
                      {e.parameters.map((pd) => (
                        <div key={pd.name} className="param">
                          <span>{pd.name}</span>
                          <input
                            value={st.params[pd.name] ?? ""}
                            onChange={(ev) =>
                              updateParam(
                                "entry",
                                e.strategy_id,
                                pd.name,
                                ev.target.value,
                              )
                            }
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            {!catalog && (
              <div style={{ color: "var(--graphite-500)", fontSize: 12, padding: 8 }}>
                加载策略清单…
              </div>
            )}
          </div>
        </section>

        {/* Exits */}
        <section className="exp1-card">
          <div className="ti-row">
            <div className="ti">
              策略选择 · Exits
              <span className="c">
                {selectedCount(exits)} / {catalog?.exits.length ?? "—"}
              </span>
            </div>
          </div>
          <div className="strat-list">
            {catalog?.exits.map((e) => {
              const st = exits[e.strategy_id] ?? { selected: false, params: {} }
              return (
                <div key={e.strategy_id} className={`strat ${st.selected ? "on" : ""}`}>
                  <label className="chk">
                    <input
                      type="checkbox"
                      checked={st.selected}
                      onChange={() => toggleStrat("exit", e.strategy_id)}
                    />
                    <span>{e.label}</span>
                  </label>
                  {st.selected && e.parameters.length > 0 && (
                    <div className="params">
                      {e.parameters.map((pd) => (
                        <div key={pd.name} className="param">
                          <span>{pd.name}</span>
                          <input
                            value={st.params[pd.name] ?? ""}
                            onChange={(ev) =>
                              updateParam(
                                "exit",
                                e.strategy_id,
                                pd.name,
                                ev.target.value,
                              )
                            }
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* Sweep */}
        <section className="exp1-card hp">
          <div className="ti-row">
            <div className="ti">参数调优 (Sweep)</div>
            <label className="switch">
              <input
                type="checkbox"
                checked={sweepEnabled}
                onChange={(e) => setSweepEnabled(e.target.checked)}
              />
              <span className="slider" />
            </label>
          </div>
          {sweepEnabled ? (
            <>
              <div className="sweep-plan">
                <div className="plan-line">
                  <span>sweep 配置</span>
                  <span className="flat">
                    由后端 expand_sweep 根据 parameter candidates 生成
                  </span>
                </div>
                <div className="plan-line">
                  <span>candidate_values</span>
                  <span className="flat">
                    （在 catalog 接口的 ParameterDescriptor 中定义）
                  </span>
                </div>
              </div>
              <div className="plan-sum">
                <div>
                  <span className="eye">预计启动</span>
                  <span className="n">{planCount} runs</span>
                  <span className="c">
                    若 catalog 未标注 sweep 候选值，则仅启动基线 1 条
                  </span>
                </div>
                <div className="plan-preview">
                  <div>
                    <strong>run_name</strong>={runName}
                  </div>
                  <div>
                    <strong>capitals</strong>={CAP_PRESETS[cap].join(", ")}
                  </div>
                  <div>
                    <strong>entries</strong>={selectedCount(entries)} selected
                  </div>
                  <div>
                    <strong>exits</strong>={selectedCount(exits)} selected
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="muted" style={{ padding: "6px 2px", color: "var(--graphite-500)" }}>
              关闭时只启动当前参数的一条实验 run。
            </div>
          )}
        </section>

        {/* Fire */}
        <section className="exp1-card foot">
          <label className="row-chk">
            <input
              type="checkbox"
              checked={extendRun}
              onChange={(e) => setExtendRun(e.target.checked)}
            />
            基于当前选中 run 增量扩展（MVP：请在运行列表中复制 run_id 后走独立流程）
          </label>
          <label className="row-chk">
            <input
              type="checkbox"
              checked={rerunPhases}
              onChange={(e) => setRerunPhases(e.target.checked)}
            />
            清空已有 phase 输出后重跑
          </label>
          <div className="fire-row">
            <div className="muted">
              将启动 <b className="n">{planCount}</b> run · 本金 {CAP_LABEL[cap]} ·{" "}
              {maxWorkers} workers
            </div>
            <button
              className="btn-fire"
              onClick={onFire}
              disabled={isFiring || !catalog}
            >
              {isFiring ? "Firing…" : "Fire ▸"}
            </button>
          </div>
          <div className="fire-hint">
            Fire 后跳转运行列表 · 实时观察 sweep 进度与每个 run 的 phase 状态
          </div>
        </section>
      </div>
    </>
  )
}
