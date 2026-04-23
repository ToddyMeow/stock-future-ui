"use client"

import { useEffect, useState, useTransition, type Dispatch, type SetStateAction } from "react"
import { toast } from "sonner"
import {
  Activity,
  Archive,
  BarChart3,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Flame,
  FolderOpen,
  History,
  Layers3,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  archiveExperimentRunClient,
  deleteExperimentRunClient,
  fetchExperimentArtifactClient,
  fetchExperimentPhaseSummaryClient,
  fetchExperimentRunClient,
  fetchExperimentStrategyCatalogClient,
  launchExperimentClient,
  listExperimentRunsClient,
  restoreExperimentRunClient,
} from "@/lib/api"
import { cn } from "@/lib/utils"
import type {
  ExperimentArtifactResponse,
  ExperimentCapitalProgress,
  ExperimentPhaseStatus,
  ExperimentPhaseSummaryResponse,
  ExperimentRunDetail,
  ExperimentRunStatus,
  ExperimentRunSummary,
  ExperimentSweepChangedDimension,
  ExperimentSweepDimension,
  ExperimentSweepMeta,
  ExperimentStrategyCatalog,
  ExperimentStrategyDescriptor,
  ExperimentStrategyParameterDescriptor,
} from "@/lib/types"

const ARTIFACTS = [
  { key: "phase0:symbols", label: "Phase 0 可交易宇宙" },
  { key: "phase1:group_stability", label: "Phase 1 组标签" },
  { key: "phase2:symbol_summary", label: "Phase 2 品种评分" },
  { key: "phase3:group_candidates", label: "Phase 3 候选组合" },
  { key: "phase4:selected_candidates", label: "Phase 4 滚动筛选" },
  { key: "phase5:portfolio_cells", label: "Phase 5 风险格子" },
  { key: "phase5:reject_reasons", label: "Phase 5 拒绝原因" },
  { key: "phase5:platform_validation", label: "平台验证" },
] as const

const EXIT_PROB_LABELS = ["5%", "7%", "10%"] as const

const COLUMN_LABELS: Record<string, string> = {
  capital: "本金",
  group_name: "组",
  symbol: "品种",
  total_bars: "总样本",
  is_bars: "IS 样本",
  oos_bars: "OOS 样本",
  single_hand_risk_threshold: "单手风险阈值",
  single_hand_risk: "单手风险",
  risk_stat: "风险统计口径",
  risk_history_scope: "风险历史范围",
  risk_atr_column: "风险 ATR 列",
  is_tradeable: "可交易",
  reject_reasons: "拒绝原因",
  stable_label: "稳定结论",
  labels_by_exit_prob: "5% / 7% / 10% 三档结论",
  a_baseline_expectancy: "A 基线期望",
  b_best_exit: "最佳出场",
  c_best_entry: "最佳入场",
  d_best_combo: "最佳组合",
  is_alpha_present: "有 alpha",
  label: "结论",
  best_exit: "最佳出场",
  significant_count: "通过档数",
  expectancy: "期望",
  win_rate: "胜率",
  avg_winner: "平均盈利单",
  avg_loser: "平均亏损单",
  wl_ratio: "盈亏比",
  kelly_edge: "Kelly 边",
  total_trades: "交易数",
  p_values: "5% / 7% / 10% 显著性",
  risk_cell_id: "风险格子",
  risk_per_trade: "单笔风险",
  group_cap: "组内上限",
  portfolio_cap: "组合上限",
  combo: "组合",
  selected_combo: "入选组合",
  pass_count: "通过窗口数",
  mean_window_excess: "平均滚动超额",
  selected_group_count: "入选组数",
  selected_groups: "入选组",
  total_return: "总收益",
  sharpe: "Sharpe",
  max_drawdown_pct: "最大回撤",
  bootstrap_ci_low: "Bootstrap 下界",
  bootstrap_ci_high: "Bootstrap 上界",
  dsr: "DSR",
  pbo_mean: "PBO 均值",
  pbo_max: "PBO 最大值",
  plateau_score: "平台分数",
  argmax_stability: "argmax 稳定度",
  platform_label: "平台判定",
}

const ALPHA_LABEL_TEXT: Record<string, string> = {
  drift_only: "纯漂移",
  exit_alpha: "出场 alpha",
  entry_alpha: "入场 alpha",
  both: "入场 + 出场都有 alpha",
  synergy_only: "只有组合协同有效",
  none: "无显著 alpha",
  unstable: "三档结论不一致",
  high_confidence: "高置信确认",
  confirmed: "确认",
  marginal: "边缘",
  reject: "拒绝",
  platform_confirmed: "平台成立",
  sharp_peak: "尖峰最优",
  not_significant: "不显著",
}

const PERCENT_COLUMNS = new Set([
  "exit_prob",
  "risk_per_trade",
  "group_cap",
  "portfolio_cap",
  "win_rate",
  "p_value",
  "b_p_value",
  "c_p_value",
  "d_p_value",
  "pbo_mean",
  "pbo_max",
  "plateau_score",
  "argmax_stability",
  "dsr",
  "pct",
  "max_drawdown_pct",
  "drawdown_from_peak",
])

const LONG_TEXT_COLUMNS = new Set([
  "reject_reasons",
  "labels_by_exit_prob",
  "p_values",
  "selected_groups",
  "selected_combo",
  "combo",
  "d_best_combo",
  "latest_log",
  "module",
])

function statusBadgeClass(status: ExperimentRunSummary["status"]) {
  if (status === "completed") return "bg-green-100 text-green-700 border-transparent"
  if (status === "running") return "bg-amber-100 text-amber-700 border-transparent"
  if (status === "interrupted") return "bg-slate-200 text-slate-800 border-transparent"
  if (status === "failed") return "bg-red-100 text-red-700 border-transparent"
  return "bg-slate-100 text-slate-700 border-transparent"
}

const DATE_COLUMNS = new Set([
  "date",
  "first_date",
  "last_date",
  "entry_date",
  "window_start",
  "window_end",
  "started_at",
  "completed_at",
  "archived_at",
])

function formatLocalDate(value: string) {
  if (!value) {
    return "—"
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
}

function phaseBadgeClass(status: ExperimentPhaseStatus) {
  if (status === "completed") return "bg-emerald-100 text-emerald-700 border-transparent"
  if (status === "running") return "bg-orange-100 text-orange-700 border-transparent"
  return "bg-slate-100 text-slate-600 border-transparent"
}

function phaseCardClass(status: ExperimentPhaseStatus, isCurrent: boolean) {
  return cn(
    "rounded-lg border px-3 py-2 transition-colors",
    status === "completed" && "border-emerald-200 bg-emerald-50/70",
    status === "running" && "border-orange-300 bg-orange-50 shadow-sm",
    status === "pending" && "border-slate-200 bg-slate-50/60",
    isCurrent && "ring-2 ring-orange-300 ring-offset-1",
  )
}

function formatCapitalLabel(capital: number | string) {
  const numericCapital =
    typeof capital === "number" ? capital : Number(String(capital).replace(/,/g, ""))
  if (Number.isFinite(numericCapital)) {
    // User prefers 10k-unit display, so 250000 => 25k.
    if (numericCapital % 10000 === 0) {
      return `${numericCapital / 10000}k`
    }
    if (numericCapital >= 1000) {
      return `${Math.round(numericCapital / 1000)}k`
    }
    return String(Math.round(numericCapital))
  }
  return String(capital)
}

function formatCapitalSet(capitals: number[]) {
  if (capitals.length === 0) {
    return "未设本金"
  }
  return capitals.map((capital) => formatCapitalLabel(capital)).join(" + ")
}

function formatRunMeta(run: Pick<ExperimentRunSummary, "capitals" | "max_workers" | "output_suffix">) {
  const parts = [formatCapitalSet(run.capitals), `${run.max_workers} workers`]
  if (run.output_suffix) {
    parts.push(run.output_suffix)
  }
  return parts.join(" · ")
}

function phaseSummaryLabel(progress: ExperimentCapitalProgress) {
  const active = progress.phases.find((phase) => phase.is_current)
  if (active) {
    return active.label
  }
  const latestDone = [...progress.phases].reverse().find((phase) => phase.status === "completed")
  return latestDone?.label ?? "待启动"
}

function capitalSummaryStatus(progress: ExperimentCapitalProgress): ExperimentPhaseStatus {
  if (progress.phases.some((phase) => phase.is_current)) {
    return "running"
  }
  if (progress.phases.every((phase) => phase.status === "completed")) {
    return "completed"
  }
  if (progress.phases.some((phase) => phase.status === "completed")) {
    return "completed"
  }
  return "pending"
}

function formatProgressLine(progress: ExperimentCapitalProgress) {
  if (
    progress.progress_completed != null &&
    progress.progress_total != null &&
    progress.progress_unit
  ) {
    const base = `${progress.progress_completed}/${progress.progress_total} ${progress.progress_unit}`
    const percent =
      progress.progress_percent != null ? ` (${progress.progress_percent}%)` : ""
    const last =
      progress.last_completed_label ? ` · last ${progress.last_completed_label}` : ""
    return `${base}${percent}${last}`
  }
  return null
}

function phaseStatusText(status: ExperimentPhaseStatus) {
  if (status === "completed") return "ready"
  if (status === "running") return "running"
  return "pending"
}

function formatAlphaLabel(value: string) {
  return ALPHA_LABEL_TEXT[value] ?? value
}

function formatPercentValue(value: number) {
  return `${Math.round(value * 100)}%`
}

function formatPValueTriplet(raw: string) {
  const parts = raw
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length === 0) {
    return raw
  }
  return parts
    .map((part) => {
      const [prob, pValue] = part.split(":")
      const probNumber = Number(prob)
      const pNumber = Number(pValue)
      const left = Number.isFinite(probNumber) ? formatPercentValue(probNumber) : prob
      const right = Number.isFinite(pNumber) ? formatPercentValue(pNumber) : pValue
      return `${left}: ${right}`
    })
    .join(" · ")
}

function formatExitProbLabels(raw: string) {
  const labels = raw
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
  if (labels.length === 0) {
    return raw
  }
  if (labels.length === EXIT_PROB_LABELS.length && labels.every((value) => value === labels[0])) {
    return `${EXIT_PROB_LABELS.join(" / ")} 均为 ${formatAlphaLabel(labels[0])}`
  }
  return labels
    .map((label, index) => `${EXIT_PROB_LABELS[index] ?? `档${index + 1}`}: ${formatAlphaLabel(label)}`)
    .join(" · ")
}

function displayColumnLabel(column: string) {
  return COLUMN_LABELS[column] ?? column
}

function formatValue(value: unknown, column?: string) {
  if (value == null) return "—"
  if (column === "capital") {
    return formatCapitalLabel(value as number | string)
  }
  if (column && DATE_COLUMNS.has(column)) {
    return formatLocalDate(String(value))
  }
  if (column === "stable_label" || column === "label" || column === "platform_label") {
    return formatAlphaLabel(String(value))
  }
  if (column === "labels_by_exit_prob") {
    return formatExitProbLabels(String(value))
  }
  if (column === "p_values") {
    return formatPValueTriplet(String(value))
  }
  if (typeof value === "boolean") {
    return value ? "是" : "否"
  }
  if (typeof value === "number") {
    if (column && (PERCENT_COLUMNS.has(column) || column.endsWith("_pct"))) {
      return formatPercentValue(value)
    }
    return value.toLocaleString("zh-CN", { maximumFractionDigits: 0 })
  }
  if (typeof value === "string" && (value.includes("T") || /^\d{4}-\d{2}-\d{2}$/.test(value))) {
    return formatLocalDate(value)
  }
  if (Array.isArray(value) || typeof value === "object") {
    return JSON.stringify(value)
  }
  return String(value)
}

function ArtifactTable({ artifact }: { artifact: ExperimentArtifactResponse | null }) {
  if (!artifact) {
    return <div className="text-sm text-muted-foreground">暂无数据</div>
  }
  const rows = artifact.rows
  const columns = rows.length > 0 ? Object.keys(rows[0]) : []
  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">
        展示 {rows.length} / {artifact.row_count} 行
      </div>
      {columns.length === 0 ? (
        <div className="text-sm text-muted-foreground">暂无数据</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table className="min-w-[720px] table-fixed lg:min-w-full">
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column} className="align-top text-xs whitespace-normal break-words">
                    {displayColumnLabel(column)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={index}>
                  {columns.map((column) => (
                    <TableCell key={column} className="align-top">
                      <div
                        className={cn(
                          "max-w-[10rem] text-xs leading-5 whitespace-normal break-words sm:max-w-[12rem] lg:max-w-[16rem]",
                          LONG_TEXT_COLUMNS.has(column) && "max-w-[16rem] break-all lg:max-w-[24rem]",
                        )}
                      >
                        {formatValue(row[column], column)}
                      </div>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function splitStrategies(items: ExperimentStrategyDescriptor[]) {
  return {
    primary: items.filter((item) => item.origin === "curated_variant" && !item.baseline_only),
    additional: items.filter((item) => !(item.origin === "curated_variant" && !item.baseline_only)),
  }
}

type StrategyParamState = Record<string, Record<string, string | number | boolean>>
type StrategyTuningState = Record<string, Record<string, string>>
type TuningSweepPlan = {
  label: string
  entryParams: Record<string, Record<string, string | number | boolean>>
  exitParams: Record<string, Record<string, string | number | boolean>>
  changedDimensions: ExperimentSweepChangedDimension[]
}

type TuningSweepPreview = {
  plans: TuningSweepPlan[]
  dimensions: ExperimentSweepDimension[]
  errors: string[]
}

type SweepGroupView = {
  groupId: string
  groupLabel: string
  createdAt: string
  memberCount: number
  dimensions: ExperimentSweepDimension[]
  runs: ExperimentRunSummary[]
  capitals: number[]
  statusCounts: Record<ExperimentRunStatus, number>
}

const SWEEP_STATUS_ORDER: ExperimentRunStatus[] = ["running", "queued", "completed", "failed", "interrupted"]

const SWEEP_STATUS_BAR_CLASS: Record<ExperimentRunStatus, string> = {
  running: "bg-orange-400",
  queued: "bg-slate-400",
  completed: "bg-emerald-500",
  failed: "bg-red-500",
  interrupted: "bg-slate-500",
}

function slugifyClient(text: string) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "run"
  )
}

function createSweepGroupId(runName: string) {
  const base = slugifyClient(runName)
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${base}-sweep-${crypto.randomUUID()}`
  }
  return `${base}-sweep-${Date.now().toString(36)}`
}

function parseTimeValueClient(value: string | null | undefined) {
  if (!value) {
    return 0
  }
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function buildSweepGroups(runs: ExperimentRunSummary[]) {
  const groups = new Map<string, SweepGroupView>()
  for (const run of runs) {
    if (!run.sweep?.group_id) {
      continue
    }
    const current = groups.get(run.sweep.group_id)
    const nextCapitals = current
      ? Array.from(new Set([...current.capitals, ...run.capitals])).sort((left, right) => left - right)
      : [...run.capitals].sort((left, right) => left - right)
    const nextStatusCounts = current
      ? { ...current.statusCounts }
      : {
          queued: 0,
          running: 0,
          completed: 0,
          failed: 0,
          interrupted: 0,
        }
    nextStatusCounts[run.status] += 1
    groups.set(run.sweep.group_id, {
      groupId: run.sweep.group_id,
      groupLabel: run.sweep.group_label,
      createdAt: current?.createdAt || run.sweep.created_at || run.started_at,
      memberCount: Math.max(current?.memberCount ?? 0, run.sweep.member_count || 0),
      dimensions: current?.dimensions ?? run.sweep.dimensions ?? [],
      runs: [...(current?.runs ?? []), run].sort((left, right) => {
        const leftIndex = left.sweep?.member_index ?? Number.MAX_SAFE_INTEGER
        const rightIndex = right.sweep?.member_index ?? Number.MAX_SAFE_INTEGER
        if (leftIndex !== rightIndex) {
          return leftIndex - rightIndex
        }
        return parseTimeValueClient(right.started_at) - parseTimeValueClient(left.started_at)
      }),
      capitals: nextCapitals,
      statusCounts: nextStatusCounts,
    })
  }
  return [...groups.values()].sort((left, right) => {
    const leftRunning = left.statusCounts.running + left.statusCounts.queued
    const rightRunning = right.statusCounts.running + right.statusCounts.queued
    if (leftRunning !== rightRunning) {
      return rightRunning - leftRunning
    }
    return parseTimeValueClient(right.createdAt) - parseTimeValueClient(left.createdAt)
  })
}

function formatParameterValueList(values: Array<string | number | boolean>) {
  return values.map((value) => formatParameterBrief(value)).join(" / ")
}

function formatChangedDimensions(dimensions: ExperimentSweepChangedDimension[]) {
  if (dimensions.length === 0) {
    return "base"
  }
  return dimensions
    .map(
      (dimension) =>
        `${dimension.strategy_id}.${dimension.parameter_name}=${formatParameterBrief(dimension.value)}`,
    )
    .join(" · ")
}

function runPhaseSummary(run: ExperimentRunSummary) {
  if (!run.capital_progress || run.capital_progress.length === 0) {
    return "无 phase 信息"
  }
  return run.capital_progress
    .map((progress) => `${formatCapitalLabel(progress.capital)} ${phaseSummaryLabel(progress)}`)
    .join(" · ")
}

function buildDefaultStrategyParamState(items: ExperimentStrategyDescriptor[]) {
  const next: StrategyParamState = {}
  for (const item of items) {
    next[item.strategy_id] = {}
    for (const parameter of item.parameters ?? []) {
      if (!parameter.editable || parameter.value == null) {
        continue
      }
      next[item.strategy_id][parameter.name] = parameter.value
    }
  }
  return next
}

function mergeStrategyParamState(current: StrategyParamState, items: ExperimentStrategyDescriptor[]) {
  const defaults = buildDefaultStrategyParamState(items)
  const next: StrategyParamState = { ...current }
  for (const [strategyId, values] of Object.entries(defaults)) {
    next[strategyId] = {
      ...values,
      ...(current[strategyId] ?? {}),
    }
  }
  return next
}

function mergeStrategyParamOverrides(
  items: ExperimentStrategyDescriptor[],
  overrides?: Record<string, Record<string, unknown>>,
) {
  const defaults = buildDefaultStrategyParamState(items)
  const next: StrategyParamState = { ...defaults }
  for (const [strategyId, rawValues] of Object.entries(overrides ?? {})) {
    if (!rawValues || typeof rawValues !== "object") {
      continue
    }
    const normalizedValues: Record<string, string | number | boolean> = {}
    for (const [name, value] of Object.entries(rawValues)) {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        normalizedValues[name] = value
      }
    }
    next[strategyId] = {
      ...(next[strategyId] ?? {}),
      ...normalizedValues,
    }
  }
  return next
}

function formatStrategyParameterLabel(name: string) {
  return name
    .split("_")
    .map((part) => {
      if (["ama", "atr", "hab", "hl", "ma", "bb"].includes(part.toLowerCase())) {
        return part.toUpperCase()
      }
      if (part.toLowerCase() === "r") {
        return "R"
      }
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join(" ")
}

function formatParameterBrief(value: unknown) {
  if (value == null) {
    return "—"
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : String(value)
  }
  if (typeof value === "boolean") {
    return value ? "是" : "否"
  }
  return String(value)
}

function parameterInputValue(
  strategyId: string,
  parameter: ExperimentStrategyParameterDescriptor,
  values: StrategyParamState,
) {
  const raw = values[strategyId]?.[parameter.name]
  const fallback = raw ?? parameter.value ?? ""
  if (typeof fallback === "boolean") {
    return fallback ? "true" : "false"
  }
  return String(fallback)
}

function coerceStrategyParameterValue(
  parameter: ExperimentStrategyParameterDescriptor,
  raw: string | number | boolean | undefined,
) {
  if (raw == null || raw === "") {
    return parameter.value
  }
  if (parameter.value_type === "boolean") {
    if (typeof raw === "boolean") {
      return raw
    }
    return String(raw) === "true"
  }
  if (parameter.value_type === "integer") {
    const parsed = Number.parseInt(String(raw), 10)
    return Number.isFinite(parsed) ? parsed : parameter.value
  }
  if (parameter.value_type === "number") {
    const parsed = Number(String(raw))
    return Number.isFinite(parsed) ? parsed : parameter.value
  }
  if (parameter.value_type === "enum") {
    const option = (parameter.options ?? []).find((candidate) => String(candidate) === String(raw))
    return option ?? String(raw)
  }
  return String(raw)
}

function buildSelectedStrategyParams(
  selected: string[],
  items: ExperimentStrategyDescriptor[],
  values: StrategyParamState,
) {
  const byId = new Map(items.map((item) => [item.strategy_id, item]))
  const payload: Record<string, Record<string, string | number | boolean>> = {}
  for (const strategyId of selected) {
    const item = byId.get(strategyId)
    if (!item) {
      continue
    }
    const params: Record<string, string | number | boolean> = {}
    for (const parameter of item.parameters ?? []) {
      if (!parameter.editable) {
        continue
      }
      const coerced = coerceStrategyParameterValue(
        parameter,
        values[strategyId]?.[parameter.name],
      )
      if (typeof coerced === "string" || typeof coerced === "number" || typeof coerced === "boolean") {
        params[parameter.name] = coerced
      }
    }
    if (Object.keys(params).length > 0) {
      payload[strategyId] = params
    }
  }
  return payload
}

function parseTuningToken(raw: string, parameter: ExperimentStrategyParameterDescriptor) {
  const token = raw.trim()
  if (!token) {
    return { ok: false as const, error: "empty" }
  }
  if (parameter.value_type === "boolean") {
    const lowered = token.toLowerCase()
    if (["true", "1", "yes", "y", "on", "是"].includes(lowered)) {
      return { ok: true as const, value: true }
    }
    if (["false", "0", "no", "n", "off", "否"].includes(lowered)) {
      return { ok: true as const, value: false }
    }
    return { ok: false as const, error: `${token} 不是有效布尔值` }
  }
  if (parameter.value_type === "integer") {
    const parsed = Number.parseInt(token, 10)
    if (Number.isFinite(parsed)) {
      return { ok: true as const, value: parsed }
    }
    return { ok: false as const, error: `${token} 不是有效整数` }
  }
  if (parameter.value_type === "number") {
    const parsed = Number(token)
    if (Number.isFinite(parsed)) {
      return { ok: true as const, value: parsed }
    }
    return { ok: false as const, error: `${token} 不是有效数字` }
  }
  if (parameter.value_type === "enum") {
    const option = (parameter.options ?? []).find((candidate) => String(candidate) === token)
    if (option !== undefined) {
      return { ok: true as const, value: option }
    }
    return {
      ok: false as const,
      error: `${token} 不在枚举候选中: ${(parameter.options ?? []).join(", ")}`,
    }
  }
  return { ok: true as const, value: token }
}

function parseTuningCandidates(raw: string, parameter: ExperimentStrategyParameterDescriptor) {
  const normalized = raw.trim()
  if (!normalized) {
    return { values: [] as Array<string | number | boolean>, errors: [] as string[] }
  }
  const values: Array<string | number | boolean> = []
  const errors: string[] = []
  const seen = new Set<string>()
  for (const token of normalized.split(/[,\n，]+/).map((part) => part.trim()).filter(Boolean)) {
    const parsed = parseTuningToken(token, parameter)
    if (!parsed.ok) {
      errors.push(`${formatStrategyParameterLabel(parameter.name)}: ${parsed.error}`)
      continue
    }
    const key = String(parsed.value)
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    values.push(parsed.value)
  }
  return { values, errors }
}

function cartesianProduct<T>(dimensions: T[][]) {
  if (dimensions.length === 0) {
    return [[]] as T[][]
  }
  return dimensions.reduce<T[][]>(
    (accumulator, current) =>
      accumulator.flatMap((prefix) => current.map((value) => [...prefix, value])),
    [[]],
  )
}

function buildTuningSweepPlans(params: {
  tuningEnabled: boolean
  selectedEntries: string[]
  selectedExits: string[]
  entryItems: ExperimentStrategyDescriptor[]
  exitItems: ExperimentStrategyDescriptor[]
  entryValues: StrategyParamState
  exitValues: StrategyParamState
  tuningValues: StrategyTuningState
}): TuningSweepPreview {
  const baseEntryParams = buildSelectedStrategyParams(
    params.selectedEntries,
    params.entryItems,
    params.entryValues,
  )
  const baseExitParams = buildSelectedStrategyParams(
    params.selectedExits,
    params.exitItems,
    params.exitValues,
  )
  if (!params.tuningEnabled) {
    return {
      plans: [
        {
          label: "base",
          entryParams: baseEntryParams,
          exitParams: baseExitParams,
          changedDimensions: [],
        },
      ] satisfies TuningSweepPlan[],
      dimensions: [] as ExperimentSweepDimension[],
      errors: [] as string[],
    }
  }

  const allItems = [...params.entryItems, ...params.exitItems]
  const selectedSet = new Set([...params.selectedEntries, ...params.selectedExits])
  const dimensions: ExperimentSweepDimension[] = []
  const errors: string[] = []

  for (const item of allItems) {
    if (!selectedSet.has(item.strategy_id)) {
      continue
    }
    for (const parameter of item.parameters ?? []) {
      const raw = params.tuningValues[item.strategy_id]?.[parameter.name] ?? ""
      const parsed = parseTuningCandidates(raw, parameter)
      errors.push(...parsed.errors.map((error) => `${item.label} · ${error}`))
      if (parsed.values.length === 0) {
        continue
      }
      const baseParams = item.kind === "entry" ? baseEntryParams : baseExitParams
      const baseValue =
        baseParams[item.strategy_id]?.[parameter.name] ??
        (typeof parameter.value === "string" || typeof parameter.value === "number" || typeof parameter.value === "boolean"
          ? parameter.value
          : null)
      const allValues = [
        ...(baseValue != null ? [baseValue] : []),
        ...parsed.values,
      ].filter((value, index, array) => array.findIndex((candidate) => String(candidate) === String(value)) === index)
      dimensions.push({
        strategy_id: item.strategy_id,
        strategy_label: item.label,
        parameter_name: parameter.name,
        parameter_label: formatStrategyParameterLabel(parameter.name),
        kind: item.kind,
        candidate_values: allValues,
        base_value: baseValue,
      })
    }
  }

  if (errors.length > 0) {
    return { plans: [] as TuningSweepPlan[], dimensions, errors }
  }
  if (dimensions.length === 0) {
    return {
      plans: [
        {
          label: "base",
          entryParams: baseEntryParams,
          exitParams: baseExitParams,
          changedDimensions: [],
        },
      ] satisfies TuningSweepPlan[],
      dimensions,
      errors: [] as string[],
    }
  }

  const planCount = dimensions.reduce((product, dimension) => product * dimension.candidate_values.length, 1)
  if (planCount > 32) {
    return {
      plans: [] as TuningSweepPlan[],
      dimensions,
      errors: [`当前调优网格会生成 ${planCount} 个 run，已超过上限 32。请收窄候选值。`],
    }
  }

  const combos = cartesianProduct(dimensions.map((dimension) => dimension.candidate_values))
  const plans = combos.map((comboValues, index) => {
    const entryParams = structuredClone(baseEntryParams)
    const exitParams = structuredClone(baseExitParams)
    const labelParts = [`tune-${String(index + 1).padStart(2, "0")}`]
    const changedDimensions: ExperimentSweepChangedDimension[] = []
    comboValues.forEach((value, comboIndex) => {
      const dimension = dimensions[comboIndex]
      const target = dimension.kind === "entry" ? entryParams : exitParams
      target[dimension.strategy_id] = {
        ...(target[dimension.strategy_id] ?? {}),
        [dimension.parameter_name]: value,
      }
      if (dimension.base_value != null && String(value) !== String(dimension.base_value)) {
        labelParts.push(`${dimension.strategy_id}.${dimension.parameter_name}=${String(value)}`)
        changedDimensions.push({
          strategy_id: dimension.strategy_id,
          strategy_label: dimension.strategy_label,
          parameter_name: dimension.parameter_name,
          parameter_label: dimension.parameter_label,
          kind: dimension.kind,
          base_value: dimension.base_value,
          value,
        })
      }
    })
    return {
      label: labelParts.join(" · "),
      entryParams,
      exitParams,
      changedDimensions,
    } satisfies TuningSweepPlan
  })
  return { plans, dimensions, errors: [] as string[] }
}

function StrategyParameterInput({
  strategyId,
  parameter,
  values,
  onChange,
}: {
  strategyId: string
  parameter: ExperimentStrategyParameterDescriptor
  values: StrategyParamState
  onChange: (strategyId: string, parameter: ExperimentStrategyParameterDescriptor, value: string | boolean) => void
}) {
  const value = parameterInputValue(strategyId, parameter, values)
  if (parameter.value_type === "enum") {
    return (
      <Select value={value} onValueChange={(next) => onChange(strategyId, parameter, next ?? "")}>
        <SelectTrigger className="h-8 w-full min-w-0 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(parameter.options ?? []).map((option) => (
            <SelectItem key={String(option)} value={String(option)}>
              {String(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }
  if (parameter.value_type === "boolean") {
    return (
      <Select value={value} onValueChange={(next) => onChange(strategyId, parameter, next === "true")}>
        <SelectTrigger className="h-8 w-full min-w-0 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">是</SelectItem>
          <SelectItem value="false">否</SelectItem>
        </SelectContent>
      </Select>
    )
  }
  return (
    <Input
      value={value}
      type={parameter.value_type === "integer" || parameter.value_type === "number" ? "number" : "text"}
      step={parameter.value_type === "integer" ? "1" : parameter.value_type === "number" ? "any" : undefined}
      onChange={(event) => onChange(strategyId, parameter, event.target.value)}
      className="h-8 text-xs"
    />
  )
}

function StrategyCard({
  item,
  checked,
  values,
  onToggle,
  onParameterChange,
}: {
  item: ExperimentStrategyDescriptor
  checked: boolean
  values: StrategyParamState
  onToggle: (strategyId: string) => void
  onParameterChange: (strategyId: string, parameter: ExperimentStrategyParameterDescriptor, value: string | boolean) => void
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-white p-3 transition-colors",
        checked ? "border-orange-300 bg-orange-50/70" : "border-slate-200",
        item.baseline_only && "opacity-60",
      )}
    >
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={checked}
          disabled={item.baseline_only}
          onChange={() => onToggle(item.strategy_id)}
          className="mt-0.5 size-4 rounded border-input"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{item.label}</span>
            {item.default_selected && (
              <Badge className="bg-slate-100 text-slate-700 border-transparent">default</Badge>
            )}
            {item.baseline_only && (
              <Badge className="bg-slate-200 text-slate-800 border-transparent">baseline only</Badge>
            )}
            {item.parameters.length > 0 && (
              <Badge className="bg-white text-slate-700 border-slate-200">
                {item.parameters.length} params
              </Badge>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground break-all">
            {item.strategy_id} · {item.origin} · {item.module}
          </div>
        </div>
      </label>

      {checked && item.parameters.length > 0 && (
        <div className="mt-3 border-t border-orange-200 pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {item.parameters.map((parameter) => (
              <div key={`${item.strategy_id}:${parameter.name}`} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-[11px] font-medium">
                    {formatStrategyParameterLabel(parameter.name)}
                  </Label>
                  <span className="text-[10px] text-muted-foreground">
                    {parameter.value_type}
                  </span>
                </div>
                <StrategyParameterInput
                  strategyId={item.strategy_id}
                  parameter={parameter}
                  values={values}
                  onChange={onParameterChange}
                />
                <div className="text-[10px] leading-4 text-muted-foreground">
                  {parameter.source === "curated_override"
                    ? `实验默认 ${formatParameterBrief(parameter.value)} · 代码默认 ${formatParameterBrief(parameter.code_default)}`
                    : `代码默认 ${formatParameterBrief(parameter.code_default)}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StrategyPanel({
  title,
  items,
  selected,
  values,
  onToggle,
  onParameterChange,
  collapsed,
  onToggleCollapsed,
  showAdditional,
  onToggleAdditional,
}: {
  title: string
  items: ExperimentStrategyDescriptor[]
  selected: string[]
  values: StrategyParamState
  onToggle: (strategyId: string) => void
  onParameterChange: (strategyId: string, parameter: ExperimentStrategyParameterDescriptor, value: string | boolean) => void
  collapsed: boolean
  onToggleCollapsed: () => void
  showAdditional: boolean
  onToggleAdditional: () => void
}) {
  const { primary, additional } = splitStrategies(items)
  const selectedAdditionalCount = additional.filter((item) => selected.includes(item.strategy_id)).length

  function renderItems(list: ExperimentStrategyDescriptor[]) {
    return (
      <div className="space-y-3">
        {list.map((item) => (
          <StrategyCard
            key={`${item.kind}:${item.strategy_id}`}
            item={item}
            checked={selected.includes(item.strategy_id)}
            values={values}
            onToggle={onToggle}
            onParameterChange={onParameterChange}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border bg-white/70 p-3">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onToggleCollapsed}
        className="w-full justify-between px-2"
      >
        <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {title}
        </span>
        <span className="text-xs text-muted-foreground">
          {collapsed ? "展开" : "折叠"}
        </span>
      </Button>
      {!collapsed && (
        <>
          {renderItems(primary)}
          {additional.length > 0 && (
            <div className="space-y-3 border-t border-slate-200 pt-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onToggleAdditional}
                className="w-full justify-between px-2"
              >
                <span className="flex items-center gap-2">
                  {showAdditional ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  更多本地策略
                </span>
                <span className="text-xs text-muted-foreground">
                  {selectedAdditionalCount > 0
                    ? `已选 ${selectedAdditionalCount} / ${additional.length}`
                    : `${additional.length} 个`}
                </span>
              </Button>
              {showAdditional && renderItems(additional)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function HyperparameterTuningPanel({
  enabled,
  onToggleEnabled,
  selectedEntries,
  selectedExits,
  entryItems,
  exitItems,
  tuningValues,
  onChange,
}: {
  enabled: boolean
  onToggleEnabled: (enabled: boolean) => void
  selectedEntries: string[]
  selectedExits: string[]
  entryItems: ExperimentStrategyDescriptor[]
  exitItems: ExperimentStrategyDescriptor[]
  tuningValues: StrategyTuningState
  onChange: (strategyId: string, parameterName: string, value: string) => void
}) {
  const selectedSet = new Set([...selectedEntries, ...selectedExits])
  const selectedStrategies = [...entryItems, ...exitItems].filter((item) => selectedSet.has(item.strategy_id))

  return (
    <div className="space-y-3 rounded-lg border bg-slate-50/80 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-muted-foreground">Hyperparameter Tuning</div>
          <div className="text-[11px] text-muted-foreground">
            基于当前参数做 grid sweep。候选值会自动包含当前值，每组组合会启动成独立 run。
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => onToggleEnabled(event.target.checked)}
            className="size-4 rounded border-input"
          />
          启用调优
        </label>
      </div>

      {!enabled ? (
        <div className="text-sm text-muted-foreground">关闭时只启动当前参数的一条实验 run。</div>
      ) : selectedStrategies.length === 0 ? (
        <div className="text-sm text-muted-foreground">先选择至少一个 entry 或 exit 策略。</div>
      ) : (
        <div className="space-y-4">
          {selectedStrategies.map((item) => (
            <div key={`tune:${item.kind}:${item.strategy_id}`} className="rounded-lg border bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-medium text-sm">{item.label}</div>
                <Badge className="bg-slate-100 text-slate-700 border-transparent">
                  {item.kind === "entry" ? "entry" : "exit"}
                </Badge>
              </div>
              {item.parameters.length === 0 ? (
                <div className="mt-2 text-xs text-muted-foreground">这个策略没有可编辑参数。</div>
              ) : (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {item.parameters.map((parameter) => (
                    <div key={`${item.strategy_id}:${parameter.name}`} className="space-y-1">
                      <Label className="text-[11px] font-medium">
                        {formatStrategyParameterLabel(parameter.name)}
                      </Label>
                      <Input
                        value={tuningValues[item.strategy_id]?.[parameter.name] ?? ""}
                        onChange={(event) => onChange(item.strategy_id, parameter.name, event.target.value)}
                        placeholder={
                          parameter.value_type === "enum"
                            ? `${(parameter.options ?? []).join(", ")}`
                            : parameter.value_type === "boolean"
                              ? "true, false"
                              : "12, 15, 18"
                        }
                        className="h-8 text-xs"
                      />
                      <div className="text-[10px] leading-4 text-muted-foreground">
                        当前值 {formatParameterBrief(parameter.value)}。留空表示不调这个参数。
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PhaseSummaryCard({
  capital,
  phaseLabel,
  summary,
}: {
  capital: string
  phaseLabel: string
  summary: ExperimentPhaseSummaryResponse | null
}) {
  if (!summary?.summary || Object.keys(summary.summary).length === 0) {
    return <div className="text-sm text-muted-foreground">{phaseLabel} summary.json 尚未产出。</div>
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{capital}</CardTitle>
        <CardDescription>{phaseLabel} 摘要</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1 text-xs">
        {Object.entries(summary.summary).map(([key, value]) => (
          <div key={key} className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <span className="text-muted-foreground">{displayColumnLabel(key)}</span>
            <span className="font-mono text-left break-all sm:max-w-[14rem] sm:text-right">
              {formatValue(value, key)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function PhaseTracker({ progress }: { progress: ExperimentCapitalProgress[] }) {
  if (progress.length === 0) {
    return <div className="text-sm text-muted-foreground">暂无 phase 进度。</div>
  }

  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}
    >
      {progress.map((capitalProgress) => (
        <div key={capitalProgress.capital} className="rounded-xl border bg-background/80 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{formatCapitalLabel(capitalProgress.capital)}</div>
                <div className="text-xs text-muted-foreground">
                  当前: {capitalProgress.current_phase_label ?? phaseSummaryLabel(capitalProgress)}
                </div>
                {formatProgressLine(capitalProgress) && (
                  <div className="mt-1 text-xs font-medium text-orange-700">
                    {formatProgressLine(capitalProgress)}
                  </div>
                )}
              </div>
            <Badge className={phaseBadgeClass(capitalSummaryStatus(capitalProgress))}>
              {phaseSummaryLabel(capitalProgress)}
            </Badge>
          </div>

          <div className="mt-4 space-y-2">
            {capitalProgress.phases.map((phase) => (
              <div key={phase.phase} className={phaseCardClass(phase.status, phase.is_current)}>
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{phase.label}</div>
                  <Badge className={phaseBadgeClass(phase.status)}>{phaseStatusText(phase.status)}</Badge>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-md bg-slate-950 px-3 py-2 text-[11px] text-slate-200 break-words">
            {capitalProgress.latest_log ?? "No phase log yet."}
          </div>
        </div>
      ))}
    </div>
  )
}

function SweepStatusBar({
  counts,
  total,
}: {
  counts: Record<ExperimentRunStatus, number>
  total: number
}) {
  if (total <= 0) {
    return <div className="h-2 rounded-full bg-slate-100" />
  }
  return (
    <div className="space-y-2">
      <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
        {SWEEP_STATUS_ORDER.map((status) => {
          const count = counts[status] ?? 0
          if (count <= 0) {
            return null
          }
          return (
            <div
              key={status}
              className={SWEEP_STATUS_BAR_CLASS[status]}
              style={{ width: `${(count / total) * 100}%` }}
            />
          )
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        {SWEEP_STATUS_ORDER.map((status) => {
          const count = counts[status] ?? 0
          if (count <= 0) {
            return null
          }
          return (
            <Badge key={status} className={cn(statusBadgeClass(status), "font-normal")}>
              {status} {count}
            </Badge>
          )
        })}
      </div>
    </div>
  )
}

function SweepGroupsPanel({
  groups,
  selectedRunId,
  onSelectRun,
}: {
  groups: SweepGroupView[]
  selectedRunId: string
  onSelectRun: (runId: string) => void
}) {
  if (groups.length === 0) {
    return <div className="text-sm text-muted-foreground">暂无调优 sweep group。新的 tuning run 会自动在这里聚合。</div>
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {groups.map((group) => {
        const filledMembers = group.runs.length
        const activeCount = (group.statusCounts.running ?? 0) + (group.statusCounts.queued ?? 0)
        return (
          <div key={group.groupId} className="rounded-xl border bg-white/80 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="font-semibold">{group.groupLabel}</div>
                <div className="text-xs text-muted-foreground">
                  {filledMembers}/{group.memberCount} runs · {formatCapitalSet(group.capitals)} · {group.dimensions.length} 个调优维度
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {formatLocalDate(group.createdAt)}
                  {activeCount > 0 ? ` · active ${activeCount}` : ""}
                </div>
              </div>
              <Badge className={activeCount > 0 ? statusBadgeClass("running") : statusBadgeClass("completed")}>
                {activeCount > 0 ? "active" : "settled"}
              </Badge>
            </div>

            <div className="mt-3">
              <SweepStatusBar counts={group.statusCounts} total={Math.max(filledMembers, group.memberCount)} />
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <BarChart3 className="h-4 w-4" />
                调优维度
              </div>
              <div className="flex flex-wrap gap-2">
                {group.dimensions.map((dimension) => (
                  <div key={`${group.groupId}:${dimension.kind}:${dimension.strategy_id}:${dimension.parameter_name}`} className="rounded-full border bg-slate-50 px-3 py-1 text-[11px] text-slate-700">
                    {dimension.strategy_label}.{dimension.parameter_label} · {formatParameterValueList(dimension.candidate_values)}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Layers3 className="h-4 w-4" />
                成员 runs
              </div>
              <div className="space-y-2">
                {group.runs.map((run) => (
                  <button
                    key={run.run_id}
                    type="button"
                    onClick={() => onSelectRun(run.run_id)}
                    className={cn(
                      "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                      selectedRunId === run.run_id ? "border-orange-300 bg-orange-50" : "border-slate-200 hover:bg-slate-50",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{run.sweep?.member_label ?? run.run_name}</span>
                          {run.sweep?.member_index != null && run.sweep?.member_count != null && (
                            <span className="text-[11px] text-muted-foreground">
                              #{run.sweep.member_index}/{run.sweep.member_count}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground break-words">
                          {formatChangedDimensions(run.sweep?.changed_dimensions ?? [])}
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {runPhaseSummary(run)}
                        </div>
                      </div>
                      <Badge className={statusBadgeClass(run.status)}>{run.status}</Badge>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function ExperimentsView() {
  const [runs, setRuns] = useState<ExperimentRunSummary[]>([])
  const [selectedRunId, setSelectedRunId] = useState("")
  const [selectedRun, setSelectedRun] = useState<ExperimentRunDetail | null>(null)
  const [selectedCapital, setSelectedCapital] = useState("")
  const [selectedArtifact, setSelectedArtifact] = useState<string>(ARTIFACTS[0].key)
  const [artifactData, setArtifactData] = useState<ExperimentArtifactResponse | null>(null)
  const [phaseSummary, setPhaseSummary] = useState<ExperimentPhaseSummaryResponse | null>(null)
  const [strategyCatalog, setStrategyCatalog] = useState<ExperimentStrategyCatalog | null>(null)
  const [selectedEntries, setSelectedEntries] = useState<string[]>([])
  const [selectedExits, setSelectedExits] = useState<string[]>([])
  const [entryParams, setEntryParams] = useState<StrategyParamState>({})
  const [exitParams, setExitParams] = useState<StrategyParamState>({})
  const [entriesCollapsed, setEntriesCollapsed] = useState(true)
  const [exitsCollapsed, setExitsCollapsed] = useState(true)
  const [tuningEnabled, setTuningEnabled] = useState(false)
  const [tuningParams, setTuningParams] = useState<StrategyTuningState>({})
  const [showAdditionalEntries, setShowAdditionalEntries] = useState(false)
  const [showAdditionalExits, setShowAdditionalExits] = useState(false)
  const [runName, setRunName] = useState("alpha-attribution")
  const [capitalChoice, setCapitalChoice] = useState("both")
  const [seedCount, setSeedCount] = useState("20")
  const [bootstrapCount, setBootstrapCount] = useState("5000")
  const [outputSuffix, setOutputSuffix] = useState("")
  const [maxWorkers, setMaxWorkers] = useState("2")
  const [extendSelectedRun, setExtendSelectedRun] = useState(false)
  const [rerunPhases, setRerunPhases] = useState(false)
  const [isPending, startTransition] = useTransition()

  const activeRuns = runs.filter((run) => !run.is_archived && (run.status === "running" || run.status === "queued"))
  const historyRuns = runs.filter(
    (run) => !run.is_archived && (run.status === "completed" || run.status === "interrupted" || run.status === "failed"),
  )
  const archivedRuns = runs.filter((run) => run.is_archived)
  const sweepGroups = buildSweepGroups(runs.filter((run) => !run.is_archived))

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    setMaxWorkers(String(Math.max(1, Math.min(window.navigator.hardwareConcurrency || 2, 8))))
  }, [])

  useEffect(() => {
    let cancelled = false
    startTransition(() => {
      void fetchExperimentStrategyCatalogClient()
        .then((catalog) => {
          if (cancelled) return
          setStrategyCatalog(catalog)
          setEntryParams((current) => mergeStrategyParamState(current, catalog.entries))
          setExitParams((current) => mergeStrategyParamState(current, catalog.exits))
          setSelectedEntries((current) =>
            current.length > 0
              ? current
              : catalog.entries
                  .filter((item) => item.default_selected && !item.baseline_only)
                  .map((item) => item.strategy_id),
          )
          setSelectedExits((current) =>
            current.length > 0
              ? current
              : catalog.exits
                  .filter((item) => item.default_selected && !item.baseline_only)
                  .map((item) => item.strategy_id),
          )
        })
        .catch((error) => {
          toast.error(error instanceof Error ? error.message : String(error))
        })
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const additionalEntryIds = new Set(splitStrategies(strategyCatalog?.entries ?? []).additional.map((item) => item.strategy_id))
    if (selectedEntries.some((strategyId) => additionalEntryIds.has(strategyId))) {
      setShowAdditionalEntries(true)
    }
  }, [strategyCatalog, selectedEntries])

  useEffect(() => {
    const additionalExitIds = new Set(splitStrategies(strategyCatalog?.exits ?? []).additional.map((item) => item.strategy_id))
    if (selectedExits.some((strategyId) => additionalExitIds.has(strategyId))) {
      setShowAdditionalExits(true)
    }
  }, [strategyCatalog, selectedExits])

  async function refreshRuns(preferredRunId?: string) {
    const nextRuns = await listExperimentRunsClient()
    setRuns(nextRuns)
    const hasCurrentSelection = nextRuns.some((run) => run.run_id === selectedRunId)
    const defaultRunId =
      nextRuns.find((run) => run.status === "running")?.run_id || nextRuns[0]?.run_id || ""
    const nextSelected =
      preferredRunId || (hasCurrentSelection ? selectedRunId : defaultRunId)
    if (nextSelected) {
      setSelectedRunId(nextSelected)
    }
  }

  useEffect(() => {
    startTransition(() => {
      void refreshRuns()
    })
    const timer = window.setInterval(() => {
      void refreshRuns()
    }, 8000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!selectedRunId) {
      return
    }
    let cancelled = false
    const load = async () => {
      const run = await fetchExperimentRunClient(selectedRunId)
      if (cancelled) return
      setSelectedRun(run)
      if ((!selectedCapital || !run.capitals.includes(Number(selectedCapital))) && run.capitals.length > 0) {
        setSelectedCapital(String(run.capitals[0]))
      }
    }
    startTransition(() => {
      void load().catch((error) => {
        toast.error(error instanceof Error ? error.message : String(error))
      })
    })
    const timer = window.setInterval(() => {
      void load().catch(() => undefined)
    }, 5000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [selectedRunId, selectedCapital])

  useEffect(() => {
    if (!selectedRunId || !selectedCapital || !selectedArtifact) {
      return
    }
    const [phase, artifact] = selectedArtifact.split(":")
    startTransition(() => {
      void fetchExperimentArtifactClient({
        runId: selectedRunId,
        capital: selectedCapital,
        phase,
        artifact,
        limit: 200,
      })
        .then(setArtifactData)
        .catch(() => setArtifactData(null))
    })
  }, [selectedRunId, selectedCapital, selectedArtifact])

  useEffect(() => {
    if (!selectedRunId || !selectedCapital || !selectedArtifact) {
      return
    }
    const [phase] = selectedArtifact.split(":")
    startTransition(() => {
      void fetchExperimentPhaseSummaryClient({
        runId: selectedRunId,
        capital: selectedCapital,
        phase,
      })
        .then(setPhaseSummary)
        .catch(() => setPhaseSummary(null))
      })
  }, [selectedRunId, selectedCapital, selectedArtifact])

  function toggleSelection(current: string[], strategyId: string) {
    return current.includes(strategyId)
      ? current.filter((value) => value !== strategyId)
      : [...current, strategyId]
  }

  function handleStrategyParameterChange(
    setter: Dispatch<SetStateAction<StrategyParamState>>,
    strategyId: string,
    parameter: ExperimentStrategyParameterDescriptor,
    value: string | boolean,
  ) {
    setter((current) => ({
      ...current,
      [strategyId]: {
        ...(current[strategyId] ?? {}),
        [parameter.name]: value,
      },
    }))
  }

  function handleTuningValueChange(strategyId: string, parameterName: string, value: string) {
    setTuningParams((current) => ({
      ...current,
      [strategyId]: {
        ...(current[strategyId] ?? {}),
        [parameterName]: value,
      },
    }))
  }

  const tuningPreview = buildTuningSweepPlans({
    tuningEnabled,
    selectedEntries,
    selectedExits,
    entryItems: strategyCatalog?.entries ?? [],
    exitItems: strategyCatalog?.exits ?? [],
    entryValues: entryParams,
    exitValues: exitParams,
    tuningValues: tuningParams,
  })

  async function handleLaunch() {
    if (selectedEntries.length === 0 || selectedExits.length === 0) {
      toast.error("至少选择一个入场策略和一个出场策略")
      return
    }
    if (tuningPreview.errors.length > 0) {
      toast.error(tuningPreview.errors[0] ?? "调优参数无效")
      return
    }
    const capitals =
      capitalChoice === "both"
        ? [250000, 1000000]
        : capitalChoice === "250k"
          ? [250000]
          : [1000000]
    const useSweepGroup = tuningEnabled && tuningPreview.plans.length > 1 && tuningPreview.dimensions.length > 0
    const sweepGroupId = useSweepGroup ? createSweepGroupId(runName) : null
    const sweepGroupLabel = useSweepGroup ? `${runName} sweep` : null
    const sweepCreatedAt = useSweepGroup ? new Date().toISOString() : null
    try {
      const launchedRuns: ExperimentRunSummary[] = []
      for (const [index, plan] of tuningPreview.plans.entries()) {
        const suffixParts = []
        if (outputSuffix.trim()) {
          suffixParts.push(outputSuffix.trim())
        }
        if (tuningEnabled && tuningPreview.plans.length > 1) {
          suffixParts.push(`tune-${String(index + 1).padStart(2, "0")}`)
        }
        const sweep: ExperimentSweepMeta | null = useSweepGroup && sweepGroupId && sweepGroupLabel && sweepCreatedAt
          ? {
              group_id: sweepGroupId,
              group_label: sweepGroupLabel,
              created_at: sweepCreatedAt,
              member_index: index + 1,
              member_count: tuningPreview.plans.length,
              member_label: plan.label,
              dimensions: tuningPreview.dimensions,
              changed_dimensions: plan.changedDimensions,
            }
          : null
        const run = await launchExperimentClient({
          run_name: runName,
          capitals,
          entries: selectedEntries,
          exits: selectedExits,
          entry_params: plan.entryParams,
          exit_params: plan.exitParams,
          seed_count: Number(seedCount),
          bootstrap_count: Number(bootstrapCount),
          output_suffix: suffixParts.join("__"),
          extend_from_run_id: extendSelectedRun && selectedRunId ? selectedRunId : null,
          rerun_phases: rerunPhases,
          max_workers: Number(maxWorkers),
          sweep,
        })
        launchedRuns.push(run)
      }
      const focusRun = launchedRuns[launchedRuns.length - 1]
      if (launchedRuns.length === 1) {
        toast.success(`实验已启动: ${focusRun.run_id}`)
      } else {
        toast.success(`已启动 ${launchedRuns.length} 个调优 run`)
      }
      setSelectedRunId(focusRun.run_id)
      await refreshRuns(focusRun.run_id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  async function handleArchive(runId: string) {
    try {
      await archiveExperimentRunClient(runId)
      toast.success(`已归档 ${runId}`)
      await refreshRuns()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  async function handleRestore(runId: string) {
    try {
      await restoreExperimentRunClient(runId)
      toast.success(`已恢复 ${runId}`)
      await refreshRuns(runId)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  async function handleDelete(runId: string) {
    if (!window.confirm(`删除 run ${runId}？这个操作不可恢复。`)) {
      return
    }
    try {
      await deleteExperimentRunClient(runId)
      toast.success(`已删除 ${runId}`)
      if (selectedRunId === runId) {
        setSelectedRun(null)
        setArtifactData(null)
        setSelectedRunId("")
      }
      await refreshRuns()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Alpha 实验平台</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fire 指令直接启动本地实验，持续跟踪 Phase 0-5、组合筛选和平台验证。
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <Card className="bg-gradient-to-br from-slate-50 to-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="h-4 w-4" />
              Fire Console
            </CardTitle>
            <CardDescription>
              启动一次 25 万 / 100 万分资本实验，支持从本地策略库勾选 entry / exit，并可选择基于当前 run 做增量扩展。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="run-name">Run Name</Label>
              <Input id="run-name" value={runName} onChange={(event) => setRunName(event.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Capitals</Label>
                <Select value={capitalChoice} onValueChange={(value) => setCapitalChoice(value ?? "both")}>
                  <SelectTrigger className="w-full min-w-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">25k + 100k</SelectItem>
                    <SelectItem value="250k">25k</SelectItem>
                    <SelectItem value="1m">100k</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="suffix">Output Suffix</Label>
                <Input id="suffix" value={outputSuffix} onChange={(event) => setOutputSuffix(event.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="seed-count">Seeds</Label>
                <Input id="seed-count" value={seedCount} onChange={(event) => setSeedCount(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bootstrap-count">Bootstrap</Label>
                <Input id="bootstrap-count" value={bootstrapCount} onChange={(event) => setBootstrapCount(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-workers">Max Workers</Label>
                <Input id="max-workers" value={maxWorkers} onChange={(event) => setMaxWorkers(event.target.value)} />
              </div>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <StrategyPanel
                title={`Entries (${selectedEntries.length})`}
                items={strategyCatalog?.entries ?? []}
                selected={selectedEntries}
                values={entryParams}
                onToggle={(strategyId) =>
                  setSelectedEntries((current) => toggleSelection(current, strategyId))
                }
                onParameterChange={(strategyId, parameter, value) =>
                  handleStrategyParameterChange(setEntryParams, strategyId, parameter, value)
                }
                collapsed={entriesCollapsed}
                onToggleCollapsed={() => setEntriesCollapsed((current) => !current)}
                showAdditional={showAdditionalEntries}
                onToggleAdditional={() => setShowAdditionalEntries((current) => !current)}
              />
              <StrategyPanel
                title={`Exits (${selectedExits.length})`}
                items={strategyCatalog?.exits ?? []}
                selected={selectedExits}
                values={exitParams}
                onToggle={(strategyId) =>
                  setSelectedExits((current) => toggleSelection(current, strategyId))
                }
                onParameterChange={(strategyId, parameter, value) =>
                  handleStrategyParameterChange(setExitParams, strategyId, parameter, value)
                }
                collapsed={exitsCollapsed}
                onToggleCollapsed={() => setExitsCollapsed((current) => !current)}
                showAdditional={showAdditionalExits}
                onToggleAdditional={() => setShowAdditionalExits((current) => !current)}
              />
            </div>
            <HyperparameterTuningPanel
              enabled={tuningEnabled}
              onToggleEnabled={setTuningEnabled}
              selectedEntries={selectedEntries}
              selectedExits={selectedExits}
              entryItems={strategyCatalog?.entries ?? []}
              exitItems={strategyCatalog?.exits ?? []}
              tuningValues={tuningParams}
              onChange={handleTuningValueChange}
            />
            <div className="rounded-lg border bg-white/70 p-3 text-xs">
              {tuningPreview.errors.length > 0 ? (
                <div className="space-y-1 text-red-600">
                  {tuningPreview.errors.slice(0, 3).map((error) => (
                    <div key={error}>{error}</div>
                  ))}
                  {tuningPreview.errors.length > 3 && (
                    <div>还有 {tuningPreview.errors.length - 3} 条错误未展开。</div>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="font-medium text-slate-800">
                    预计启动 {tuningPreview.plans.length} 个 run
                  </div>
                  <div className="text-muted-foreground">
                    调优关闭时为 1 个；调优开启后按候选值笛卡尔展开，且每个参数自动包含当前值。
                  </div>
                  {tuningPreview.dimensions.length > 0 && (
                    <div className="grid gap-2 pt-2 md:grid-cols-2">
                      {tuningPreview.dimensions.map((dimension) => (
                        <div
                          key={`preview:${dimension.kind}:${dimension.strategy_id}:${dimension.parameter_name}`}
                          className="rounded-md border bg-slate-50 px-2 py-2"
                        >
                          <div className="font-medium text-slate-800">
                            {dimension.strategy_label}.{dimension.parameter_label}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {formatParameterValueList(dimension.candidate_values)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {tuningPreview.plans.length > 1 && (
                    <div className="space-y-1 pt-1 text-muted-foreground">
                      {tuningPreview.plans.slice(0, 4).map((plan) => (
                        <div key={plan.label} className="break-words">
                          {plan.label}
                        </div>
                      ))}
                      {tuningPreview.plans.length > 4 && (
                        <div>还有 {tuningPreview.plans.length - 4} 组组合未展开。</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const nextEntryDefaults = buildDefaultStrategyParamState(strategyCatalog?.entries ?? [])
                  const nextExitDefaults = buildDefaultStrategyParamState(strategyCatalog?.exits ?? [])
                  setSelectedEntries(
                    (strategyCatalog?.entries ?? [])
                      .filter((item) => item.default_selected && !item.baseline_only)
                      .map((item) => item.strategy_id),
                  )
                  setEntryParams(nextEntryDefaults)
                  setSelectedExits(
                    (strategyCatalog?.exits ?? [])
                      .filter((item) => item.default_selected && !item.baseline_only)
                      .map((item) => item.strategy_id),
                  )
                  setExitParams(nextExitDefaults)
                  setTuningParams({})
                  setTuningEnabled(false)
                }}
              >
                恢复默认策略集
              </Button>
              {selectedRun?.manifest && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const manifest = selectedRun.manifest as {
                      real_entries?: string[]
                      real_exits?: string[]
                      entry_params?: Record<string, Record<string, unknown>>
                      exit_params?: Record<string, Record<string, unknown>>
                    }
                    setSelectedEntries(manifest.real_entries ?? [])
                    setSelectedExits(manifest.real_exits ?? [])
                    setEntryParams(
                      mergeStrategyParamOverrides(
                        strategyCatalog?.entries ?? [],
                        manifest.entry_params,
                      ),
                    )
                    setExitParams(
                      mergeStrategyParamOverrides(
                        strategyCatalog?.exits ?? [],
                        manifest.exit_params,
                      ),
                    )
                    setTuningParams({})
                    setTuningEnabled(false)
                  }}
                >
                  载入当前 run 策略集
                </Button>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={extendSelectedRun}
                onChange={(event) => setExtendSelectedRun(event.target.checked)}
                className="size-4 rounded border-input"
              />
              基于当前选中 run 增量扩展
              {selectedRunId && (
                <span className="min-w-0 break-all text-xs text-muted-foreground">
                  {selectedRunId}
                </span>
              )}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={rerunPhases}
                onChange={(event) => setRerunPhases(event.target.checked)}
                className="size-4 rounded border-input"
              />
              清空已有 phase 输出后重跑
            </label>
            <Button
              onClick={() => startTransition(() => void handleLaunch())}
              className="w-full"
              disabled={
                isPending ||
                selectedEntries.length === 0 ||
                selectedExits.length === 0 ||
                tuningPreview.errors.length > 0 ||
                tuningPreview.plans.length === 0
              }
            >
              {isPending ? "Launching..." : "Fire"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Run Registry</span>
              <Button variant="outline" size="sm" onClick={() => startTransition(() => void refreshRuns())}>
                <RefreshCw className="h-4 w-4 mr-2" />
                刷新
              </Button>
            </CardTitle>
            <CardDescription>
              活跃运行记录，只保留 running / queued。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeRuns.length === 0 ? (
              <div className="text-sm text-muted-foreground">当前没有活跃 run。</div>
            ) : (
              activeRuns.slice(0, 12).map((run) => (
                <button
                  key={run.run_id}
                  type="button"
                  onClick={() => setSelectedRunId(run.run_id)}
                  className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                    selectedRunId === run.run_id ? "border-foreground bg-accent" : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{run.run_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatRunMeta(run)} · {formatLocalDate(run.started_at)}
                      </div>
                      {run.sweep && (
                        <div className="text-[11px] text-muted-foreground">
                          {run.sweep.group_label} · #{run.sweep.member_index}/{run.sweep.member_count}
                        </div>
                      )}
                      <div className="text-[11px] text-muted-foreground/80 break-all">{run.run_id}</div>
                    </div>
                    <Badge className={statusBadgeClass(run.status)}>{run.status}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>本金: {formatCapitalSet(run.capitals)}</span>
                    <span>workers: {run.max_workers}</span>
                    <span>pid: {run.pid ?? "—"}</span>
                  </div>
                  {run.capital_progress.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {run.capital_progress.map((progress) => (
                        <Badge
                          key={progress.capital}
                          className={cn(
                            phaseBadgeClass(capitalSummaryStatus(progress)),
                            "font-normal",
                          )}
                        >
                          {formatCapitalLabel(progress.capital)} · {phaseSummaryLabel(progress)}
                          {progress.progress_completed != null &&
                            progress.progress_total != null &&
                            ` ${progress.progress_completed}/${progress.progress_total}`}
                        </Badge>
                      ))}
                    </div>
                  )}
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Sweep Groups
          </CardTitle>
          <CardDescription>
            把 tuning run 聚合成 sweep group，直接看这次调优改了哪些参数、目前有哪些成员、整体状态分布如何。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SweepGroupsPanel
            groups={sweepGroups}
            selectedRunId={selectedRunId}
            onSelectRun={setSelectedRunId}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              History
            </CardTitle>
            <CardDescription>
              已结束但未归档的 run。可以归档或直接删除。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {historyRuns.length === 0 ? (
              <div className="text-sm text-muted-foreground">暂无历史 run。</div>
            ) : (
              historyRuns.map((run) => (
                <div key={run.run_id} className="rounded-lg border px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => setSelectedRunId(run.run_id)}
                        className="text-left"
                      >
                        <div className="font-medium">{run.run_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatRunMeta(run)} · {formatLocalDate(run.started_at)}
                        </div>
                        <div className="text-[11px] text-muted-foreground/80 break-all">{run.run_id}</div>
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={statusBadgeClass(run.status)}>{run.status}</Badge>
                      <Button variant="outline" size="sm" onClick={() => startTransition(() => void handleArchive(run.run_id))}>
                        <Archive className="mr-2 h-4 w-4" />
                        归档
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => startTransition(() => void handleDelete(run.run_id))}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        删除
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Archive className="h-4 w-4" />
              Archived
            </CardTitle>
            <CardDescription>
              已归档 run，不干扰主 registry；需要时可恢复或删除。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {archivedRuns.length === 0 ? (
              <div className="text-sm text-muted-foreground">暂无归档 run。</div>
            ) : (
              archivedRuns.map((run) => (
                <div key={run.run_id} className="rounded-lg border px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => setSelectedRunId(run.run_id)}
                        className="text-left"
                      >
                        <div className="font-medium">{run.run_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatRunMeta(run)} · {formatLocalDate(run.started_at)}
                        </div>
                        <div className="text-[11px] text-muted-foreground/80 break-all">
                          {run.run_id} · archived {formatLocalDate(run.archived_at ?? "")}
                        </div>
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={statusBadgeClass(run.status)}>{run.status}</Badge>
                      <Button variant="outline" size="sm" onClick={() => startTransition(() => void handleRestore(run.run_id))}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        恢复
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => startTransition(() => void handleDelete(run.run_id))}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        删除
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {selectedRun && (
        <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Run Detail
              </CardTitle>
              <CardDescription>
                <span className="break-all">
                  {formatRunMeta(selectedRun)} · {selectedRun.run_id}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">状态</span>
                <Badge className={statusBadgeClass(selectedRun.status)}>{selectedRun.status}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">开始</span>
                <span>{formatLocalDate(selectedRun.started_at || "")}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">完成</span>
                <span>{formatLocalDate(selectedRun.completed_at || "")}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">CPU workers</span>
                <span>{selectedRun.max_workers}</span>
              </div>
              {selectedRun.sweep && (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">Sweep Group</span>
                    <span className="text-right">{selectedRun.sweep.group_label}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">Sweep Member</span>
                    <span className="text-right">
                      #{selectedRun.sweep.member_index}/{selectedRun.sweep.member_count} · {selectedRun.sweep.member_label}
                    </span>
                  </div>
                </>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">进程 PID</span>
                <span>{selectedRun.pid ?? "—"}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`/workspace-api/experiments/${selectedRun.run_id}/report`, "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  打开报告
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(selectedRun.summary_path)
                    toast.success("summary.json 路径已复制")
                  }}
                >
                  <FolderOpen className="h-4 w-4 mr-2" />
                  复制 summary 路径
                </Button>
              </div>

              <div className="rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
                <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap break-all">
                  {selectedRun.log_tail || "No logs yet."}
                </pre>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Phase Tracker</CardTitle>
                <CardDescription>
                  每个本金单独一栏，当前正在执行的 phase 会高亮显示。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PhaseTracker progress={selectedRun.capital_progress} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Capital Explorer</CardTitle>
                <CardDescription>
                  选本金和 phase artifact，直接浏览当前 run 的关键输出表。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <div className="space-y-2">
                    <Label>Capital</Label>
                    <Select value={selectedCapital || null} onValueChange={(value) => setSelectedCapital(value ?? "")}>
                      <SelectTrigger className="w-full sm:w-36">
                        <SelectValue placeholder="选择本金" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedRun.capitals.map((capital) => (
                          <SelectItem key={capital} value={String(capital)}>
                            {formatCapitalLabel(capital)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Artifact</Label>
                    <Select value={selectedArtifact} onValueChange={(value) => setSelectedArtifact(value ?? ARTIFACTS[0].key)}>
                      <SelectTrigger className="w-full sm:w-60">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ARTIFACTS.map((artifact) => (
                          <SelectItem key={artifact.key} value={artifact.key}>
                            {artifact.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Tabs defaultValue="summary">
                  <TabsList>
                    <TabsTrigger value="summary">摘要</TabsTrigger>
                    <TabsTrigger value="artifact">表格</TabsTrigger>
                  </TabsList>
                  <TabsContent value="summary" className="mt-4">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <PhaseSummaryCard
                        capital={formatCapitalLabel(Number(selectedCapital))}
                        phaseLabel={ARTIFACTS.find((artifact) => artifact.key === selectedArtifact)?.label ?? selectedArtifact}
                        summary={phaseSummary}
                      />
                    </div>
                  </TabsContent>
                  <TabsContent value="artifact" className="mt-4">
                    <ArtifactTable artifact={artifactData} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
