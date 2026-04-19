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
  // 前端展示用（后端由市值服务算）
  unrealized_pnl?: number
  last_price?: number
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
