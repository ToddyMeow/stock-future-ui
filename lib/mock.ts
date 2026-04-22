/**
 * lib/mock.ts — fetchOrMock 降级的"空骨架"工厂
 *
 * 原为 P2a 演示的假数据工厂，用户 2026-04-19 要求清空。
 * 现在所有 mock 工厂返回空数组 / 空骨架：
 *   - 后端可达有数据  → 显示真数据
 *   - 后端可达无数据  → 显示空
 *   - 后端不可达      → 降级到这里的空骨架 + 红色 banner（MockBanner 会提示"后端未连接"）
 *
 * 保留工具函数（formatCurrency / formatPct / formatDate / formatTime）供页面格式化用。
 */

import type {
  Alert,
  AnalyticsBreakdown,
  DailyPnl,
  DailyReport,
  Fill,
  Instruction,
  Position,
  RollCandidate,
  UniverseSymbol,
} from "./types"

// =====================================================================
// 空工厂（6 个）
// =====================================================================

export function mockInstructions(): Instruction[] {
  return []
}

export function mockFills(_instructionId: string): Fill[] {
  return []
}

export function mockPositions(): Position[] {
  return []
}

export function mockDailyPnl(_days = 90): DailyPnl[] {
  return []
}

export function mockAlerts(): Alert[] {
  return []
}

export function mockDailyReport(date: string): DailyReport {
  // 返回最小骨架避免前端崩；所有数值为 0
  return {
    date,
    daily_pnl: {
      date,
      equity: 0,
      cash: 0,
      open_positions_mv: 0,
      realized_pnl_today: 0,
      unrealized_pnl_today: 0,
      soft_stop_triggered: false,
      drawdown_from_peak: 0,
      peak_equity_to_date: 0,
      notes: null,
      created_at: `${date}T00:00:00.000Z`,
      updated_at: `${date}T00:00:00.000Z`,
    },
    kpi: {
      pnl_today: 0,
      pnl_cumulative: 0,
      sharpe: 0,
      max_drawdown: 0,
      trade_count_today: 0,
      veto_count_today: 0,
    },
    instructions_summary: {
      pending: 0,
      fully_filled: 0,
      partially_filled: 0,
      vetoed: 0,
      skipped: 0,
      expired: 0,
    },
    vetoed_list: [],
  }
}

export function mockAnalyticsBreakdown(): AnalyticsBreakdown {
  return { by_symbol: [], by_group: [] }
}

export function mockRolls(): RollCandidate[] {
  return []
}

export function mockUniverse(): UniverseSymbol[] {
  return []
}

// =====================================================================
// 工具：格式化（页面仍在使用，保留）
// =====================================================================

export function formatCurrency(n: number, withSign = false): string {
  const sign = n > 0 ? "+" : ""
  const abs = Math.abs(n)
  const str = `¥${abs.toLocaleString("zh-CN", { maximumFractionDigits: 0 })}`
  if (n < 0) return `-${str}`
  return withSign ? `${sign}${str}` : str
}

export function formatPct(n: number, digits = 2): string {
  return `${(n * 100).toFixed(digits)}%`
}

export function formatDate(iso: string): string {
  // 接受 ISO 或 YYYY-MM-DD
  return iso.slice(0, 10)
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}
