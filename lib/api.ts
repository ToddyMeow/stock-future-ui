/**
 * lib/api.ts — 真实 REST API 客户端（P2b 实现）
 *
 * 后端：/Users/mm/Trading/stock-future/live/web/api.py（FastAPI）
 *   - 默认 base 取 `process.env.NEXT_PUBLIC_API_URL`，缺省 http://localhost:8000
 *   - 所有 GET 强制 `cache: "no-store"`，避免 Next RSC 默认缓存污染实盘数据
 *   - 非 2xx 抛 Error，由调用方（页面层）捕获并走 mock 降级
 *   - fetchOrMock() 是页面层的降级封装，集中处理 `isMock` 标志位
 */
import type {
  Alert,
  AlertSeverity,
  DailyPnl,
  DailyReport,
  EngineStatus,
  Fill,
  FillCreate,
  FormulasContext,
  Instruction,
  InstructionStatus,
  Position,
  RollCandidate,
  RollConfirmResponse,
  UniverseSymbol,
} from "./types"

// =====================================================================
// 基础 fetch 封装
// =====================================================================

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window === "undefined"
    ? "http://127.0.0.1:8000"
    : "")

/** 健康检查响应（后端 health 端点结构）。 */
export interface HealthResponse {
  status: string
  db: string
  version: string
}

/** POST /api/fills 响应结构（后端返回 fill + instruction 两个对象）。 */
export interface PostFillResponse {
  fill: Fill
  instruction: Instruction | null
}

/** GET /api/history 响应结构。 */
export interface HistoryResponse {
  date: string
  instructions: Instruction[]
}

/** 后端 /api/reports/{date} 原始响应结构（扁平，非 DailyReport）。 */
interface RawReportResponse {
  report_date: string
  equity: number
  pnl_today: number
  drawdown: number
  instructions_summary: Record<string, number>
  vetoed_summary: Array<{
    symbol: string
    contract_code: string
    veto_reason: string | null
  } & Record<string, unknown>>
  equity_series: { date: string; equity: number }[]
}

/** 通用 JSON HTTP 请求封装。 */
async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(
      `${res.status} ${res.statusText}: ${body.slice(0, 200)}`,
    )
  }
  return (await res.json()) as T
}

// =====================================================================
// 10 个业务端点
// =====================================================================

/** GET /api/health — 健康检查 + DB 连通性。 */
export async function fetchHealth(): Promise<HealthResponse> {
  return http<HealthResponse>("/api/health")
}

/** GET /api/instructions?date=...&session=... — 当日指令（可选时段）。 */
export async function fetchInstructions(
  date: string,
  session?: "day" | "night",
): Promise<Instruction[]> {
  const q = new URLSearchParams({ date })
  if (session) q.set("session", session)
  return http<Instruction[]>(`/api/instructions?${q.toString()}`)
}

/** POST /api/fills — 提交成交回填。 */
export async function postFill(fill: FillCreate): Promise<PostFillResponse> {
  return http<PostFillResponse>("/api/fills", {
    method: "POST",
    body: JSON.stringify(fill),
  })
}

/** POST /api/instructions/{id}/veto — 人工否决。 */
export async function vetoInstruction(
  id: string,
  reason: string,
): Promise<Instruction> {
  return http<Instruction>(`/api/instructions/${id}/veto`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  })
}

/** POST /api/instructions/{id}/skip — 标记跳过。 */
export async function skipInstruction(id: string): Promise<Instruction> {
  return http<Instruction>(`/api/instructions/${id}/skip`, {
    method: "POST",
  })
}

/** GET /api/positions — 当前活跃持仓列表。 */
export async function fetchPositions(): Promise<Position[]> {
  return http<Position[]>("/api/positions")
}

/** GET /api/rolls — 主力合约切换候选（Q6）。 */
export async function fetchRolls(): Promise<RollCandidate[]> {
  return http<RollCandidate[]>("/api/rolls")
}

/**
 * POST /api/rolls/confirm — 换约一键确认（Q6）。
 *
 * 提交旧合约平仓均价 + 新合约开仓均价；后端在单事务内
 * 完成 positions 迁移 + 2 条 fully_filled instructions + 2 条
 * fills（trigger_source=roll_contract）+ 1 条 info alerts。
 */
export async function postRollConfirm(body: {
  symbol: string
  old_contract: string
  new_contract: string
  old_close_price: number
  new_open_price: number
  closed_at?: string
  opened_at?: string
  note?: string
}): Promise<RollConfirmResponse> {
  return http<RollConfirmResponse>("/api/rolls/confirm", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

/** GET /api/daily_pnl?from=...&to=... — 日结权益序列。 */
export async function fetchDailyPnl(
  from: string,
  to: string,
): Promise<DailyPnl[]> {
  const q = new URLSearchParams({ from, to })
  return http<DailyPnl[]>(`/api/daily_pnl?${q.toString()}`)
}

/** GET /api/history?date=... — 历史按日查询（指令 + view 聚合 fills 字段）。 */
export async function fetchHistory(date: string): Promise<HistoryResponse> {
  const q = new URLSearchParams({ date })
  return http<HistoryResponse>(`/api/history?${q.toString()}`)
}

/**
 * GET /api/reports/{date} — 每日报告。
 *
 * 后端返回扁平结构（report_date / equity / pnl_today / ...），
 * 前端 DailyReport 类型需要 daily_pnl / kpi / vetoed_list 嵌套 —
 * 这里做一次轻量映射，最大化复用 P2a 页面层。
 *
 * 注意：
 *   - Sharpe / max_drawdown / trade_count_today / veto_count_today
 *     后端尚未产出，临时填 0（后续后端补齐再替换）。
 *   - daily_pnl 也是后端没有的嵌套字段，用 equity / drawdown 拼最低字段集。
 */
export async function fetchReport(date: string): Promise<DailyReport> {
  const raw = await http<RawReportResponse>(`/api/reports/${date}`)

  const summary = raw.instructions_summary ?? {}
  const asInt = (k: string) => Number(summary[k] ?? 0)
  const trade_count =
    asInt("fully_filled") + asInt("partially_filled")
  const veto_count = asInt("vetoed")

  // 拼出最低可用 DailyPnl —— 只用于页面头部展示 peak_equity_to_date 等
  const daily_pnl: DailyPnl = {
    date: raw.report_date,
    equity: raw.equity,
    cash: 0,
    open_positions_mv: 0,
    realized_pnl_today: raw.pnl_today,
    unrealized_pnl_today: 0,
    soft_stop_triggered: false,
    drawdown_from_peak: raw.drawdown,
    peak_equity_to_date: null,
    notes: null,
    created_at: `${raw.report_date}T16:00:00.000Z`,
    updated_at: `${raw.report_date}T16:00:00.000Z`,
  }

  // 累计 PnL 用 equity_series 首末差近似（后端未独立产出）
  const first = raw.equity_series[0]
  const pnl_cumulative = first
    ? raw.equity - first.equity
    : 0

  return {
    date: raw.report_date,
    daily_pnl,
    kpi: {
      pnl_today: raw.pnl_today,
      pnl_cumulative,
      sharpe: 0, // 后端未提供
      max_drawdown: raw.drawdown,
      trade_count_today: trade_count,
      veto_count_today: veto_count,
    },
    instructions_summary: {
      pending: asInt("pending"),
      fully_filled: asInt("fully_filled"),
      partially_filled: asInt("partially_filled"),
      vetoed: asInt("vetoed"),
      skipped: asInt("skipped"),
      expired: asInt("expired"),
    } as Record<InstructionStatus, number>,
    vetoed_list: (raw.vetoed_summary ?? []).map((v) => ({
      symbol: String(v.symbol ?? ""),
      contract_code: String(v.contract_code ?? ""),
      reason: String(v.veto_reason ?? ""),
    })),
  }
}

/** GET /api/alerts/recent?n=...&severity=... — 最近告警。 */
export async function fetchRecentAlerts(
  n: number = 50,
  severity?: AlertSeverity,
): Promise<Alert[]> {
  const q = new URLSearchParams({ n: String(n) })
  if (severity) q.set("severity", severity)
  return http<Alert[]>(`/api/alerts/recent?${q.toString()}`)
}

/**
 * GET /api/engine-status — 引擎活体 / launchd 下次触发 / 最近 14 天指令 / 告警。
 *
 * 前端 /engine-status 页面 30 秒自动刷新用。
 */
export async function fetchEngineStatus(): Promise<EngineStatus> {
  return http<EngineStatus>("/api/engine-status")
}

/**
 * GET /api/analytics/breakdown — 按品种 / 组的交易归因聚合。
 *
 * MVP 后端返空结构（fills 表空），实盘成交后升级为真实聚合 SQL。
 */
export async function fetchAnalyticsBreakdown(): Promise<import("./types").AnalyticsBreakdown> {
  return http<import("./types").AnalyticsBreakdown>("/api/analytics/breakdown")
}

/**
 * GET /api/universe — 盯盘品种清单（final_v3 配置 13 品种）。
 *
 * 后端融合了 phase0_250k 单手风险 + phase3 combo + bars 最新主力 + positions，
 * 前端用于 /universe 页展示"今天盯盘哪些品种、哪些 25 万下能开仓"。
 */
export async function fetchUniverse(): Promise<UniverseSymbol[]> {
  return http<UniverseSymbol[]>("/api/universe")
}

/**
 * GET /api/formulas-context — /formulas 页"代入公式所需的当前实盘数字"。
 *
 * 后端聚合 live/config.py + signal_service 覆盖 + EngineConfig 默认 +
 * daily_pnl 最新一行 + positions 按定义 B 聚合。
 */
export async function fetchFormulasContext(): Promise<FormulasContext> {
  return http<FormulasContext>("/api/formulas-context")
}

// =====================================================================
// 降级封装 — 页面层复用
// =====================================================================

/**
 * fetchOrMock(fetchFn, mockFn)
 *   - 真调用成功：返回 { data, isMock: false }
 *   - 真调用失败（网络错误 / 非 2xx）：返回 { data: mockFn(), isMock: true }
 *     页面层据此渲染顶部红色 banner。
 */
export async function fetchOrMock<T>(
  fetchFn: () => Promise<T>,
  mockFn: () => T,
): Promise<{ data: T; isMock: boolean; error?: string }> {
  try {
    const data = await fetchFn()
    return { data, isMock: false }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    // 开发期打到 server log，便于排查
    if (typeof console !== "undefined") {
      console.warn(`[fetchOrMock] 降级到 mock：${error}`)
    }
    return { data: mockFn(), isMock: true, error }
  }
}

/** 仅在浏览器环境使用 — Client Component 的降级版。 */
export async function fetchOrMockClient<T>(
  fetchFn: () => Promise<T>,
  mockFn: () => T,
): Promise<{ data: T; isMock: boolean; error?: string }> {
  return fetchOrMock(fetchFn, mockFn)
}
