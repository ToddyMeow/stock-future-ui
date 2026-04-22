/**
 * lib/types.ts — 前端 TypeScript 类型，对齐后端 Pydantic v2 models
 * 来源：/Users/mm/Trading/stock-future/live/db/models.py
 *
 * 约定：
 *  - 时间字段一律 ISO-8601 字符串（带时区），前端展示时 new Date() 转
 *  - 日期字段（session_date 等）统一 "YYYY-MM-DD" 字符串
 *  - 金额 / 价格用 number（后端 Decimal 序列化后前端无精度需求）
 */

// =====================================================================
// Enums（与后端同词表）
// =====================================================================

export type InstructionStatus =
  | "pending"
  | "fully_filled"
  | "partially_filled"
  | "vetoed"
  | "skipped"
  | "expired"

export type InstructionAction = "open" | "close" | "add" | "reduce"

export type InstructionDirection = "long" | "short"

export type InstructionSession = "day" | "night"

export type AlertSeverity = "info" | "warn" | "critical"

export type TriggerSource =
  | "user_manual"
  | "stop_loss"
  | "take_profit"
  | "roll_contract"

// =====================================================================
// 读模型
// =====================================================================

/**
 * 调仓指令（signal_service 产出）。
 * 含 v_instructions_with_fills view 聚合字段：filled_qty_total / avg_filled_price
 */
export interface Instruction {
  id: string // UUID
  generated_at: string // ISO
  session_date: string // YYYY-MM-DD
  session: InstructionSession
  symbol: string
  contract_code: string
  action: InstructionAction
  direction: InstructionDirection
  target_qty: number
  entry_price_ref: number | null
  stop_loss_ref: number | null
  group_name: string
  status: InstructionStatus
  veto_reason: string | null
  broker_stop_order_id: string | null
  created_at: string
  updated_at: string
  // view 聚合字段
  filled_qty_total?: number
  avg_filled_price?: number | null
}

/** 当前持仓快照。 */
export interface Position {
  symbol: string
  contract_code: string
  qty: number // 正=多头，负=空头
  avg_entry_price: number
  stop_loss_price: number | null
  group_name: string
  opened_at: string
  last_updated_at: string
  notes: string | null
  // enriched 字段（后端 get_positions_enriched 派生，全 optional 保兼容）
  last_price?: number | null // 最近一日 bars.settle（"最近一日结算价"）
  last_settle_date?: string | null // YYYY-MM-DD；那一日
  contract_multiplier?: number | null // bars.contract_multiplier（AO=20 等）
  unrealized_pnl?: number | null // (last_price - avg_entry) * qty * multiplier
  notional_mv?: number | null // |qty| * last_price * multiplier
}

/** 成交明细（一条 instruction 可多条 fill）。 */
export interface Fill {
  id: string
  instruction_id: string
  filled_qty: number
  filled_price: number
  filled_at: string
  trigger_source: TriggerSource
  note: string | null
  created_at: string
}

/** 每日结算快照（权益曲线 + soft stop 源）。 */
export interface DailyPnl {
  date: string // YYYY-MM-DD
  equity: number
  cash: number
  open_positions_mv: number
  realized_pnl_today: number
  unrealized_pnl_today: number
  soft_stop_triggered: boolean
  drawdown_from_peak: number | null
  peak_equity_to_date: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

/** 审计日志 / 告警。 */
export interface Alert {
  id: number
  event_at: string
  severity: AlertSeverity
  event_type: string
  message: string
  payload: Record<string, unknown> | null
}

// =====================================================================
// 写模型（POST /api/fills 用）
// =====================================================================

export interface FillCreate {
  instruction_id: string
  filled_qty: number
  filled_price: number
  filled_at: string
  trigger_source: TriggerSource
  note: string | null
}

// =====================================================================
// 聚合 / 展示专用
// =====================================================================

/** 每日报告（/api/reports/{date} 聚合响应）。 */
export interface DailyReport {
  date: string
  daily_pnl: DailyPnl
  kpi: {
    pnl_today: number
    pnl_cumulative: number
    sharpe: number
    max_drawdown: number
    trade_count_today: number
    veto_count_today: number
  }
  instructions_summary: Record<InstructionStatus, number>
  vetoed_list: { symbol: string; contract_code: string; reason: string }[]
}

/**
 * 主力合约切换候选（Q6）。
 *
 * 后端 /api/rolls 返回：持仓 contract_code ≠ bars 最新主力 order_book_id 时
 * 产生一条候选。后端 Decimal 序列化为字符串，前端按需 Number() 转。
 */
export interface RollCandidate {
  symbol: string
  current_contract: string
  new_dominant_contract: string
  last_observed_date: string // YYYY-MM-DD
  current_last_price: number | string | null
  new_last_price: number | string | null
  avg_entry_price: number | string
  qty: number
  group_name: string
}

/**
 * POST /api/rolls/confirm 响应（Q6 换约一键确认）。
 *
 * 后端 Decimal 序列化为字符串，前端按需 Number() 转。
 */
export interface RollConfirmResponse {
  symbol: string
  old_contract: string
  new_contract: string
  qty: number
  old_close_price: number | string
  new_open_price: number | string
  closed_instruction_id: string // UUID
  opened_instruction_id: string // UUID
  new_position: Position
}

/** 按品种 / 组的归因 breakdown。 */
export interface SymbolBreakdown {
  symbol: string
  group_name: string
  pnl_cumulative: number
  win_rate: number
  trade_count: number
  recent_pnl_series: { idx: number; pnl: number }[] // 最近 10 笔 mini chart
}

export interface GroupBreakdown {
  group_name: string
  pnl_cumulative: number
  symbols: { symbol: string; weight: number; pnl: number }[]
}

export interface AnalyticsBreakdown {
  by_symbol: SymbolBreakdown[]
  by_group: GroupBreakdown[]
}

// =====================================================================
// UI 辅助
// =====================================================================

export const STATUS_LABELS: Record<InstructionStatus, string> = {
  pending: "待处理",
  fully_filled: "完全成交",
  partially_filled: "部分成交",
  vetoed: "已否决",
  skipped: "已跳过",
  expired: "已过期",
}

export const ACTION_LABELS: Record<InstructionAction, string> = {
  open: "开仓",
  close: "平仓",
  add: "加仓",
  reduce: "减仓",
}

export const DIRECTION_LABELS: Record<InstructionDirection, string> = {
  long: "多",
  short: "空",
}

export const TRIGGER_SOURCE_LABELS: Record<TriggerSource, string> = {
  user_manual: "手动下单",
  stop_loss: "止损触发",
  take_profit: "止盈触发",
  roll_contract: "换月移仓",
}

export const SESSION_LABELS: Record<InstructionSession, string> = {
  day: "日盘",
  night: "夜盘",
}

export const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  info: "信息",
  warn: "警告",
  critical: "严重",
}

// =====================================================================
// Engine Status（GET /api/engine-status — 引擎心跳 / launchd 下次触发）
// =====================================================================

/**
 * engine_states 表最新一行摘要。
 * 后端不回传完整 state JSON（太大），只给长度 / last_date / bytes。
 */
export interface EngineStateSummary {
  session_date: string // YYYY-MM-DD
  session: InstructionSession
  state_last_date: string | null // state["last_date"]；engine 已回放到哪一日
  state_positions_count: number
  state_bytes: number
  created_at: string // ISO
}

/** 某一日指令总数 + 按状态 breakdown。 */
export interface InstructionsDayCount {
  date: string // YYYY-MM-DD
  total: number
  by_status: Record<string, number>
}

/** daily_pnl 最新一行精简快照。 */
export interface CapitalSnapshot {
  date: string
  equity: number | string
  cash: number | string
  open_positions_mv: number | string
  drawdown_from_peak: number | string | null
  peak_equity_to_date: number | string | null
}

/** launchd plist 展开的单个触发点。 */
export interface LaunchdSlot {
  label: string
  hour: number
  minute: number
  description: string
  next_fire: string // ISO with +08:00
}

/** GET /api/engine-status 聚合响应体。 */
export interface EngineStatus {
  latest_state: EngineStateSummary | null
  instructions_by_date: InstructionsDayCount[]
  alerts_24h_count: { info: number; warn: number; critical: number }
  recent_alerts: Alert[]
  db_health: string
  launchd_schedule: LaunchdSlot[]
  server_time: string // ISO with tz
  server_timezone: string
  capital_snapshot: CapitalSnapshot | null
}

// =====================================================================
// Universe（GET /api/universe — 盯盘品种清单 final_v3 配置 13 品种）
// =====================================================================

// =====================================================================
// Formulas Context（GET /api/formulas-context —— /formulas 页"代入公式的实盘值"）
// =====================================================================

/**
 * /formulas 页后端聚合响应体。
 *
 * 数据融合来源（后端 api.py::formulas_context）：
 *   1. live/config.py —— INITIAL_CAPITAL / SOFT_STOP_* 等
 *   2. live/signal_service::build_engine_cfg_for_live —— risk_per_trade /
 *      portfolio_risk_cap / group_risk_cap_default 等 final_v3 生产参数
 *   3. strats/engine_config::EngineConfig —— max_portfolio_leverage /
 *      unrealized_exposure_soft_cap / stop_atr_mult / atr_period
 *   4. daily_pnl 最新一行 —— equity / cash / peak / drawdown
 *   5. positions enriched —— 按定义 B 聚合 principal_risk /
 *      unrealized_exposure / notional
 *
 * Decimal 字段后端序列化为 string，前端按需 Number() 转。
 */
export interface FormulasContext {
  // 配置常量
  initial_capital: number | string
  risk_per_trade: number
  portfolio_risk_cap: number
  group_risk_cap_default: number
  max_portfolio_leverage: number
  soft_stop_pct: number
  soft_stop_enabled: boolean
  unrealized_exposure_soft_cap: number
  stop_atr_mult: number
  atr_period: number

  // 账户实时
  equity: number | string | null
  cash: number | string | null
  peak_equity: number | string | null
  drawdown_from_peak: number | string | null
  snapshot_date: string | null // YYYY-MM-DD

  // 派生预算
  risk_budget_per_trade: number | string
  portfolio_cap_amount: number | string
  group_cap_default_amount: number | string
  leverage_cap_amount: number | string

  // 当前持仓聚合（B 定义）
  positions_count: number
  total_principal_risk: number | string
  total_unrealized_exposure: number | string
  total_notional: number | string
  current_leverage: number | string
}

/**
 * 单个盯盘品种的融合快照。
 *
 * 数据融合来源（后端 api.py::list_universe）：
 *   1. phase0_250k/final_v3_comparison.csv（静态：group / multiplier / 单手风险 / 25 万下可交易）
 *   2. phase3/best_combos_stable_final_v3.csv（每个 group 绑定的 combo 名）
 *   3. bars 表 — 最新一日主力合约 / 结算价 / 合约乘数
 *   4. positions 表 — 是否持仓 + 当前手数
 *
 * Decimal 字段后端序列化为 string，前端按需 Number() 转。
 */
export interface UniverseSymbol {
  symbol: string
  group_name: string
  combo: string
  contract_code: string | null
  last_settle: number | string | null
  last_settle_date: string | null // YYYY-MM-DD
  contract_multiplier: number | string | null
  single_contract_risk: number | string | null
  tradeable_250k: boolean
  in_position: boolean
  position_qty: number | null
  // ---- 最近一次 signal_service 诊断（migration 004） ----
  last_session_date: string | null // YYYY-MM-DD
  last_session: "day" | "night" | null
  last_entry_trigger: boolean | null
  last_entry_direction: number | null // 1 long / -1 short / 0|null 无
  last_reject_reason: string | null  // null = trigger 通过；非 null = trigger 了但被某层风控拒
  last_miss_reason: string | null    // 未 trigger 时的具体解释（indicator 数值 + 距离 trigger 多少 σ）
}
