import { spawn, spawnSync } from "node:child_process"
import { promises as fsPromises } from "node:fs"
import { existsSync, openSync, statSync } from "node:fs"
import os from "node:os"
import path from "node:path"

import type {
  ExperimentArtifactResponse,
  ExperimentCapitalProgress,
  ExperimentLaunchRequest,
  ExperimentPhaseId,
  ExperimentPhaseStatus,
  ExperimentPhaseSummaryResponse,
  ExperimentRunDetail,
  ExperimentRunSummary,
  ExperimentSweepMeta,
  ExperimentStrategyCatalog,
} from "@/lib/types"

const BACKEND_ROOT = "/Users/mm/Trading/stock-future"
const RUNS_ROOT = path.join(BACKEND_ROOT, "data", "runs")
const PYTHON_BIN =
  process.env.EXPERIMENT_PYTHON_BIN || "/Users/mm/opt/miniconda3/bin/python"
const ARCHIVE_MARKER = ".archived.json"
const PHASE_SEQUENCE: Array<{ id: ExperimentPhaseId; label: string }> = [
  { id: "phase0", label: "Phase 0" },
  { id: "phase1", label: "Phase 1" },
  { id: "phase2", label: "Phase 2" },
  { id: "phase3", label: "Phase 3" },
  { id: "phase4", label: "Phase 4" },
  { id: "phase5", label: "Phase 5" },
]

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "run"
}

function localTimestamp(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
}

function capitalToken(capitals: number[]) {
  const values = [...capitals].sort((a, b) => a - b)
  return values
    .map((capital) => {
      if (capital % 1000000 === 0) {
        return `${capital / 1000000}m`
      }
      if (capital % 1000 === 0) {
        return `${capital / 1000}k`
      }
      return String(capital)
    })
    .join("_")
}

function buildRunId(params: {
  runName: string
  capitals: number[]
  maxWorkers: number
  outputSuffix?: string
}) {
  const parts = [
    slugify(params.runName),
    `caps-${capitalToken(params.capitals)}`,
    `w${params.maxWorkers}`,
  ]
  if (params.outputSuffix) {
    parts.push(`tag-${slugify(params.outputSuffix)}`)
  }
  parts.push(localTimestamp())
  return parts.join("__")
}

async function ensureDir(dir: string) {
  await fsPromises.mkdir(dir, { recursive: true })
}

async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  if (!existsSync(filePath)) {
    return null
  }
  return JSON.parse(await fsPromises.readFile(filePath, "utf-8")) as T
}

async function readTextIfExists(filePath: string): Promise<string> {
  if (!existsSync(filePath)) {
    return ""
  }
  return fsPromises.readFile(filePath, "utf-8")
}

async function readArchiveMeta(baseDir: string) {
  return readJsonIfExists<{ archived_at?: string }>(path.join(baseDir, ARCHIVE_MARKER))
}

function isPidRunning(pid: number | null | undefined) {
  if (!pid || pid <= 0) {
    return false
  }
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

type LiveRunProcess = {
  pid: number
  command: string
}

function findLiveRunProcesses(runId: string): LiveRunProcess[] {
  const result = spawnSync("ps", ["-axo", "pid=,args="], {
    encoding: "utf-8",
  })
  if (result.status !== 0) {
    return []
  }
  const marker = `--run-id ${runId}`
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\s+(.+)$/)
      if (!match) {
        return null
      }
      return {
        pid: Number(match[1]),
        command: match[2],
      } satisfies LiveRunProcess
    })
    .filter((value): value is LiveRunProcess => Boolean(value))
    .filter((entry) => entry.command.includes("experiments.cli") && entry.command.includes(marker))
    .sort((left, right) => left.pid - right.pid)
}

function inferLivePid(runId: string, explicitPid?: number | null) {
  if (isPidRunning(explicitPid)) {
    return explicitPid ?? null
  }
  const live = findLiveRunProcesses(runId)
  return live[0]?.pid ?? null
}

function inferMaxWorkers({
  launcher,
  livePid,
  runId,
}: {
  launcher: Record<string, unknown> | null
  livePid: number | null
  runId: string
}) {
  const launcherValue = Number(launcher?.max_workers ?? 0)
  if (launcherValue > 0) {
    return launcherValue
  }
  if (!livePid) {
    return 1
  }
  const live = findLiveRunProcesses(runId).find((entry) => entry.pid === livePid)
  const match = live?.command.match(/--max-workers\s+(\d+)/)
  return Number(match?.[1] ?? 1) || 1
}

function inferStartedAt({
  summary,
  launcher,
  logText,
  baseDir,
}: {
  summary: Record<string, unknown> | null
  launcher: Record<string, unknown> | null
  logText: string
  baseDir: string
}) {
  const value = String(summary?.started_at ?? launcher?.started_at ?? "")
  if (value) {
    return value
  }
  const logPath = existsSync(path.join(baseDir, "run.log"))
    ? path.join(baseDir, "run.log")
    : path.join(baseDir, "launcher.log")
  try {
    const stat = statSync(logPath)
    return stat.birthtime.toISOString()
  } catch {
    return ""
  }
}

function readSweepMeta(payload: Record<string, unknown> | null): ExperimentSweepMeta | null {
  if (!payload?.sweep || typeof payload.sweep !== "object") {
    return null
  }
  return payload.sweep as ExperimentSweepMeta
}

function inferStatus({
  summary,
  pid,
  logText,
}: {
  summary: Record<string, unknown> | null
  pid?: number | null
  logText: string
}): ExperimentRunSummary["status"] {
  if (summary?.completed_at) {
    return "completed"
  }
  if (isPidRunning(pid)) {
    return "running"
  }
  if (logText.includes("Traceback") || logText.toLowerCase().includes("error")) {
    return "failed"
  }
  if (logText.trim().length > 0) {
    return "interrupted"
  }
  return "queued"
}

function tailText(text: string, maxChars = 16000) {
  if (text.length <= maxChars) {
    return text
  }
  return text.slice(-maxChars)
}

function runStatusRank(status: ExperimentRunSummary["status"]) {
  if (status === "running") return 0
  if (status === "queued") return 1
  if (status === "completed") return 1
  if (status === "interrupted") return 2
  if (status === "failed") return 3
  return 4
}

function parseTimeValue(value: string | null | undefined) {
  if (!value) {
    return 0
  }
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function archiveRank(isArchived: boolean) {
  return isArchived ? 1 : 0
}

type ParsedCapitalPhaseCursor = {
  phase: ExperimentPhaseId
  line: string
  progress_completed: number | null
  progress_total: number | null
  progress_unit: string | null
  progress_percent: number | null
  last_completed_label: string | null
}

function parseCapitalPhaseCursor(logText: string) {
  const latest = new Map<number, ParsedCapitalPhaseCursor>()
  const phasePattern = /Phase\s+([0-5])\s+capital=(\d+):/
  const dispatchPattern =
    /Phase\s+([0-5])\s+capital=(\d+):\s+dispatching\s+(\d+)\s+(.+?)\s+across\s+\d+\s+workers/
  const progressPattern =
    /Phase\s+([0-5])\s+capital=(\d+):\s+progress\s+(\d+)\/(\d+)\s+(.+?)\s+\((\d+)%\)(?:\s+\[last=(.+)\])?/

  for (const line of logText.split(/\r?\n/)) {
    const progressMatch = line.match(progressPattern)
    if (progressMatch) {
      latest.set(Number(progressMatch[2]), {
        phase: `phase${progressMatch[1]}` as ExperimentPhaseId,
        line,
        progress_completed: Number(progressMatch[3]),
        progress_total: Number(progressMatch[4]),
        progress_unit: progressMatch[5],
        progress_percent: Number(progressMatch[6]),
        last_completed_label: progressMatch[7] ?? null,
      })
      continue
    }

    const dispatchMatch = line.match(dispatchPattern)
    if (dispatchMatch) {
      latest.set(Number(dispatchMatch[2]), {
        phase: `phase${dispatchMatch[1]}` as ExperimentPhaseId,
        line,
        progress_completed: 0,
        progress_total: Number(dispatchMatch[3]),
        progress_unit: dispatchMatch[4],
        progress_percent: 0,
        last_completed_label: null,
      })
      continue
    }

    const match = line.match(phasePattern)
    if (!match) {
      continue
    }
    const capital = Number(match[2])
    const previous = latest.get(capital)
    latest.set(capital, {
      phase: `phase${match[1]}` as ExperimentPhaseId,
      line,
      progress_completed: previous?.phase === `phase${match[1]}` ? previous.progress_completed : null,
      progress_total: previous?.phase === `phase${match[1]}` ? previous.progress_total : null,
      progress_unit: previous?.phase === `phase${match[1]}` ? previous.progress_unit : null,
      progress_percent: previous?.phase === `phase${match[1]}` ? previous.progress_percent : null,
      last_completed_label: previous?.phase === `phase${match[1]}` ? previous.last_completed_label : null,
    })
  }
  return latest
}

async function phaseHasOutput(capitalDir: string, phaseId: ExperimentPhaseId) {
  const phaseDir = path.join(capitalDir, phaseId)
  if (!existsSync(phaseDir)) {
    return false
  }
  const entries = await fsPromises.readdir(phaseDir).catch(() => [])
  return entries.length > 0
}

export async function readExperimentStrategyCatalog(): Promise<ExperimentStrategyCatalog> {
  const inline = [
    "import json",
    "from experiments.strategies import list_strategy_catalog",
    "print(json.dumps(list_strategy_catalog(), ensure_ascii=False))",
  ].join("; ")
  const result = spawnSync(PYTHON_BIN, ["-c", inline], {
    cwd: BACKEND_ROOT,
    encoding: "utf-8",
    env: {
      ...process.env,
      PYTHONUNBUFFERED: "1",
    },
  })
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || result.stdout?.trim() || "failed to load strategy catalog")
  }
  return JSON.parse(result.stdout) as ExperimentStrategyCatalog
}

async function buildCapitalProgress(params: {
  baseDir: string
  capitals: number[]
  runStatus: ExperimentRunSummary["status"]
  logText: string
}): Promise<ExperimentCapitalProgress[]> {
  const latestByCapital = parseCapitalPhaseCursor(params.logText)
  return Promise.all(
    params.capitals.map(async (capital) => {
      const capitalDir = path.join(params.baseDir, `cap_${capital}`)
      const latest = latestByCapital.get(capital)
      const currentIndex =
        params.runStatus === "running" && latest
          ? PHASE_SEQUENCE.findIndex((phase) => phase.id === latest.phase)
          : -1

      const phaseRows = await Promise.all(
        PHASE_SEQUENCE.map(async (phase, index) => {
          const hasOutput = await phaseHasOutput(capitalDir, phase.id)
          let status: ExperimentPhaseStatus = hasOutput ? "completed" : "pending"
          if (currentIndex >= 0 && index < currentIndex) {
            status = "completed"
          }
          if (currentIndex === index) {
            status = "running"
          }
          return {
            phase: phase.id,
            label: phase.label,
            status,
            has_output: hasOutput,
            is_current: currentIndex === index,
          }
        }),
      )

      return {
        capital,
        current_phase: currentIndex >= 0 ? PHASE_SEQUENCE[currentIndex]?.id ?? null : null,
        current_phase_label: currentIndex >= 0 ? PHASE_SEQUENCE[currentIndex]?.label ?? null : null,
        latest_log: latest?.line ?? null,
        progress_completed: latest?.progress_completed ?? null,
        progress_total: latest?.progress_total ?? null,
        progress_unit: latest?.progress_unit ?? null,
        progress_percent: latest?.progress_percent ?? null,
        last_completed_label: latest?.last_completed_label ?? null,
        phases: phaseRows,
      } satisfies ExperimentCapitalProgress
    }),
  )
}

export async function listExperimentRuns(): Promise<ExperimentRunSummary[]> {
  await ensureDir(RUNS_ROOT)
  const entries = await fsPromises.readdir(RUNS_ROOT, { withFileTypes: true })
  const runs = (
    await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const runId = entry.name
        const baseDir = path.join(RUNS_ROOT, runId)
        const manifestPath = path.join(baseDir, "manifest.json")
        const summaryPath = path.join(baseDir, "summary.json")
        const launcherPath = path.join(baseDir, "launcher.json")
        const hasExperimentMeta =
          existsSync(manifestPath) || existsSync(summaryPath) || existsSync(launcherPath)
        if (!hasExperimentMeta) {
          return null
        }

        const manifest = await readJsonIfExists<Record<string, unknown>>(manifestPath)
        const summary = await readJsonIfExists<Record<string, unknown>>(summaryPath)
        const launcher = await readJsonIfExists<Record<string, unknown>>(launcherPath)
        const archiveMeta = await readArchiveMeta(baseDir)
        const logText =
          (await readTextIfExists(path.join(baseDir, "run.log"))) ||
          (await readTextIfExists(path.join(baseDir, "launcher.log")))

        const pid = inferLivePid(runId, Number(launcher?.pid ?? 0) || null)
        const startedAt = inferStartedAt({ summary, launcher, logText, baseDir })
        const capitals = Array.isArray(manifest?.capitals)
          ? (manifest?.capitals as number[])
          : Array.isArray(launcher?.capitals)
            ? (launcher?.capitals as number[])
            : []
        const runStatus = inferStatus({ summary, pid, logText })
        const sweep = readSweepMeta(manifest) ?? readSweepMeta(launcher)
        const capitalProgress = await buildCapitalProgress({
          baseDir,
          capitals,
          runStatus,
          logText,
        })
        return {
          run_id: runId,
          run_name: String(manifest?.run_name ?? launcher?.run_name ?? runId),
          output_suffix: String(manifest?.output_suffix ?? launcher?.output_suffix ?? "") || null,
          status: runStatus,
          is_archived: Boolean(archiveMeta?.archived_at),
          archived_at: archiveMeta?.archived_at ?? null,
          started_at: startedAt,
          completed_at: summary?.completed_at ? String(summary.completed_at) : null,
          capitals,
          pid,
          max_workers: inferMaxWorkers({ launcher, livePid: pid, runId }),
          summary_path: path.join(baseDir, "summary.json"),
          report_path: path.join(baseDir, "report.html"),
          log_path: existsSync(path.join(baseDir, "run.log"))
            ? path.join(baseDir, "run.log")
            : path.join(baseDir, "launcher.log"),
          capital_summaries: (summary?.capitals as Record<string, unknown> | undefined) ?? null,
          capital_progress: capitalProgress,
          sweep,
        } satisfies ExperimentRunSummary
      }),
    )
  ).filter((run): run is ExperimentRunSummary => Boolean(run))

  return runs.sort((a, b) => {
    const archiveDiff = archiveRank(a.is_archived) - archiveRank(b.is_archived)
    if (archiveDiff !== 0) {
      return archiveDiff
    }
    const statusDiff = runStatusRank(a.status) - runStatusRank(b.status)
    if (statusDiff !== 0) {
      return statusDiff
    }
    const startedDiff = parseTimeValue(b.started_at) - parseTimeValue(a.started_at)
    if (startedDiff !== 0) {
      return startedDiff
    }
    return b.run_id.localeCompare(a.run_id)
  })
}

export async function launchExperiment(request: ExperimentLaunchRequest): Promise<ExperimentRunSummary> {
  const capitals = request.capitals.length > 0 ? request.capitals : [250000, 1000000]
  const maxWorkers = Math.max(
    1,
    Number(request.max_workers || Math.min(os.cpus().length || 1, capitals.length || 1)),
  )
  const runId =
    request.run_id ||
    buildRunId({
      runName: request.run_name,
      capitals,
      maxWorkers,
      outputSuffix: request.output_suffix,
    })
  const baseDir = path.join(RUNS_ROOT, runId)
  await ensureDir(baseDir)
  const launcherLogPath = path.join(baseDir, "launcher.log")

  const command = [
    "-m",
    "experiments.cli",
    "--run-name",
    request.run_name,
    "--run-id",
    runId,
    "--capitals",
    capitals.join(","),
    "--entries",
    (request.entries ?? []).join(","),
    "--exits",
    (request.exits ?? []).join(","),
    "--entry-params-json",
    JSON.stringify(request.entry_params ?? {}),
    "--exit-params-json",
    JSON.stringify(request.exit_params ?? {}),
    "--seed-count",
    String(request.seed_count),
    "--bootstrap-count",
    String(request.bootstrap_count),
    "--max-workers",
    String(maxWorkers),
  ]
  if (request.output_suffix) {
    command.push("--output-suffix", request.output_suffix)
  }
  if (request.extend_from_run_id) {
    command.push("--extend-from-run-id", request.extend_from_run_id)
  }
  if (request.rerun_phases) {
    command.push("--rerun-phases")
  }

  const launcherMeta = {
    run_id: runId,
    run_name: request.run_name,
    started_at: new Date().toISOString(),
    capitals,
    entries: request.entries ?? [],
    exits: request.exits ?? [],
    entry_params: request.entry_params ?? {},
    exit_params: request.exit_params ?? {},
    seed_count: request.seed_count,
    bootstrap_count: request.bootstrap_count,
    output_suffix: request.output_suffix ?? "",
    extend_from_run_id: request.extend_from_run_id ?? null,
    rerun_phases: Boolean(request.rerun_phases),
    max_workers: maxWorkers,
    sweep: request.sweep ?? null,
    command: [PYTHON_BIN, ...command],
    pid: null as number | null,
  }
  await fsPromises.writeFile(
    path.join(baseDir, "launcher.json"),
    JSON.stringify(launcherMeta, null, 2),
    "utf-8",
  )

  const logFd = openSync(launcherLogPath, "a")
  const child = spawn(PYTHON_BIN, command, {
    cwd: BACKEND_ROOT,
    detached: true,
    stdio: ["ignore", logFd, logFd],
    env: {
      ...process.env,
      PYTHONUNBUFFERED: "1",
      OMP_NUM_THREADS: "1",
      OPENBLAS_NUM_THREADS: "1",
      MKL_NUM_THREADS: "1",
      NUMEXPR_NUM_THREADS: "1",
    },
  })
  child.unref()

  launcherMeta.pid = child.pid ?? null
  await fsPromises.writeFile(
    path.join(baseDir, "launcher.json"),
    JSON.stringify(launcherMeta, null, 2),
    "utf-8",
  )

  return {
    run_id: runId,
    run_name: request.run_name,
    output_suffix: request.output_suffix ?? null,
    status: "running",
    is_archived: false,
    archived_at: null,
    started_at: launcherMeta.started_at,
    completed_at: null,
    capitals,
    pid: launcherMeta.pid,
    max_workers: maxWorkers,
    summary_path: path.join(baseDir, "summary.json"),
    report_path: path.join(baseDir, "report.html"),
    log_path: path.join(baseDir, "launcher.log"),
    capital_summaries: null,
    capital_progress: capitals.map((capital) => ({
      capital,
      current_phase: null,
      current_phase_label: null,
      latest_log: null,
      progress_completed: null,
      progress_total: null,
      progress_unit: null,
      progress_percent: null,
      last_completed_label: null,
      phases: PHASE_SEQUENCE.map((phase) => ({
        phase: phase.id,
        label: phase.label,
        status: "pending",
        has_output: false,
        is_current: false,
      })),
    })),
    sweep: request.sweep ?? null,
  }
}

export async function readExperimentRun(runId: string): Promise<ExperimentRunDetail | null> {
  const baseDir = path.join(RUNS_ROOT, runId)
  if (!existsSync(baseDir)) {
    return null
  }

  const manifest = await readJsonIfExists<Record<string, unknown>>(path.join(baseDir, "manifest.json"))
  const summary = await readJsonIfExists<Record<string, unknown>>(path.join(baseDir, "summary.json"))
  const launcher = await readJsonIfExists<Record<string, unknown>>(path.join(baseDir, "launcher.json"))
  const archiveMeta = await readArchiveMeta(baseDir)
  const logText =
    (await readTextIfExists(path.join(baseDir, "run.log"))) ||
    (await readTextIfExists(path.join(baseDir, "launcher.log")))
  const pid = inferLivePid(runId, Number(launcher?.pid ?? 0) || null)
  const capitals = Array.isArray(manifest?.capitals)
    ? (manifest?.capitals as number[])
    : Array.isArray(launcher?.capitals)
      ? (launcher?.capitals as number[])
      : []
  const runStatus = inferStatus({ summary, pid, logText })
  const sweep = readSweepMeta(manifest) ?? readSweepMeta(launcher)
  const capitalProgress = await buildCapitalProgress({
    baseDir,
    capitals,
    runStatus,
    logText,
  })

  return {
    run_id: runId,
    run_name: String(manifest?.run_name ?? launcher?.run_name ?? runId),
    output_suffix: String(manifest?.output_suffix ?? launcher?.output_suffix ?? "") || null,
    status: runStatus,
    is_archived: Boolean(archiveMeta?.archived_at),
    archived_at: archiveMeta?.archived_at ?? null,
    started_at: inferStartedAt({ summary, launcher, logText, baseDir }),
    completed_at: summary?.completed_at ? String(summary.completed_at) : null,
    capitals,
    pid,
    max_workers: inferMaxWorkers({ launcher, livePid: pid, runId }),
    summary_path: path.join(baseDir, "summary.json"),
    report_path: path.join(baseDir, "report.html"),
    log_path: existsSync(path.join(baseDir, "run.log"))
      ? path.join(baseDir, "run.log")
      : path.join(baseDir, "launcher.log"),
    capital_summaries: (summary?.capitals as Record<string, unknown> | undefined) ?? null,
    capital_progress: capitalProgress,
    sweep,
    manifest,
    summary,
    log_tail: tailText(logText),
  }
}

export async function readExperimentArtifact(params: {
  runId: string
  capital: string
  phase: string
  artifact: string
  limit?: number
}): Promise<ExperimentArtifactResponse | null> {
  const filePath = path.join(
    RUNS_ROOT,
    params.runId,
    `cap_${params.capital}`,
    params.phase,
    `${params.artifact}.json`,
  )
  if (!existsSync(filePath)) {
    return null
  }
  const rows = await readJsonIfExists<Array<Record<string, unknown>>>(filePath)
  const data = rows ?? []
  const limit = Math.max(1, params.limit ?? 200)
  return {
    run_id: params.runId,
    capital: params.capital,
    phase: params.phase,
    artifact: params.artifact,
    row_count: data.length,
    rows: data.slice(0, limit),
  }
}

export async function readExperimentPhaseSummary(params: {
  runId: string
  capital: string
  phase: string
}): Promise<ExperimentPhaseSummaryResponse | null> {
  const filePath = path.join(
    RUNS_ROOT,
    params.runId,
    `cap_${params.capital}`,
    params.phase,
    "summary.json",
  )
  if (!existsSync(filePath)) {
    return null
  }
  const summary = await readJsonIfExists<Record<string, unknown>>(filePath)
  return {
    run_id: params.runId,
    capital: params.capital,
    phase: params.phase,
    summary,
  }
}

export async function readExperimentReport(runId: string) {
  const reportPath = path.join(RUNS_ROOT, runId, "report.html")
  if (!existsSync(reportPath)) {
    return null
  }
  return fsPromises.readFile(reportPath, "utf-8")
}

async function requireMutableRun(runId: string) {
  const run = await readExperimentRun(runId)
  if (!run) {
    throw new Error("run not found")
  }
  if (run.status === "running") {
    throw new Error("cannot mutate a running run")
  }
  const baseDir = path.join(RUNS_ROOT, runId)
  return { run, baseDir }
}

export async function archiveExperimentRun(runId: string) {
  const { baseDir } = await requireMutableRun(runId)
  await fsPromises.writeFile(
    path.join(baseDir, ARCHIVE_MARKER),
    JSON.stringify({ archived_at: new Date().toISOString() }, null, 2),
    "utf-8",
  )
  return readExperimentRun(runId)
}

export async function restoreExperimentRun(runId: string) {
  const { baseDir } = await requireMutableRun(runId)
  const archivePath = path.join(baseDir, ARCHIVE_MARKER)
  if (existsSync(archivePath)) {
    await fsPromises.rm(archivePath, { force: true })
  }
  return readExperimentRun(runId)
}

export async function deleteExperimentRun(runId: string) {
  const { baseDir } = await requireMutableRun(runId)
  await fsPromises.rm(baseDir, { recursive: true, force: true })
}
