/**
 * lib/mock.ts — mock 数据工厂（P2a 演示用，P2b 接 API 后删）
 *
 * 用确定性种子保证截图前后数据一致，不产生 React key diff 抖动。
 */

import type {
  Alert,
  AnalyticsBreakdown,
  DailyPnl,
  DailyReport,
  Fill,
  Instruction,
  InstructionStatus,
  Position,
} from "./types"

// =====================================================================
// 确定性伪随机（Mulberry32）
// =====================================================================

function makeRng(seed = 20260419) {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

// =====================================================================
// 共享常量
// =====================================================================

const GROUPS: Record<string, string> = {
  AO: "黑色金属",
  SA: "化工",
  FG: "化工",
  SH: "化工",
  SP: "有色",
  AP: "农产品",
  CF: "软商品",
  JD: "农产品",
  AG: "贵金属",
  RB: "黑色金属",
}

const CONTRACT_CODES: Record<string, string> = {
  AO: "AO2505",
  SA: "SA2605",
  FG: "FG2605",
  SH: "SH2509",
  SP: "SP2507",
  AP: "AP2610",
  CF: "CF2605",
  JD: "JD2505",
  AG: "AG2606",
  RB: "RB2510",
}

const TODAY = "2026-04-19"
const NOW_ISO = `${TODAY}T02:15:00.000Z`

// =====================================================================
// mockInstructions(n=8)
// =====================================================================

/**
 * 返回 8 条指令，状态分布：
 *   3 pending / 1 fully_filled / 1 partially_filled / 1 vetoed / 1 skipped / 1 expired
 */
export function mockInstructions(): Instruction[] {
  const rows: Array<
    [
      symbol: string,
      action: Instruction["action"],
      direction: Instruction["direction"],
      qty: number,
      entry: number,
      stop: number,
      status: InstructionStatus,
      fillQty: number,
      veto?: string,
      stopOrderId?: string,
    ]
  > = [
    ["AO", "open", "long", 3, 15420, 15080, "pending", 0],
    ["SA", "add", "long", 2, 1358, 1332, "pending", 0],
    ["JD", "open", "long", 2, 3450, 3380, "pending", 0],
    ["CF", "open", "short", 1, 13950, 14180, "fully_filled", 1, undefined, "BR20260419-7712"],
    ["FG", "open", "long", 4, 1092, 1065, "partially_filled", 2],
    [
      "SP",
      "close",
      "short",
      2,
      18240,
      0,
      "vetoed",
      0,
      "盘前公告突发，价格跳空，暂不建仓",
    ],
    ["AP", "add", "long", 1, 8620, 8450, "skipped", 0],
    ["SH", "open", "short", 3, 2856, 2920, "expired", 0],
  ]

  return rows.map(([symbol, action, direction, qty, entry, stop, status, fillQty, veto, brokerId], i) => ({
    id: `inst-${String(i + 1).padStart(4, "0")}-20260419`,
    generated_at: `${TODAY}T01:30:00.000Z`,
    session_date: TODAY,
    session: "day" as const,
    symbol,
    contract_code: CONTRACT_CODES[symbol],
    action,
    direction,
    target_qty: qty,
    entry_price_ref: entry,
    stop_loss_ref: stop || null,
    group_name: GROUPS[symbol] ?? "其他",
    status,
    veto_reason: veto ?? null,
    broker_stop_order_id: brokerId ?? null,
    created_at: `${TODAY}T01:30:00.000Z`,
    updated_at: NOW_ISO,
    filled_qty_total: fillQty,
    avg_filled_price:
      fillQty > 0
        ? Number((entry * (0.998 + 0.004 * ((i + 1) / 10))).toFixed(2))
        : null,
  }))
}

// =====================================================================
// mockFills — 给历史页嵌套子表用
// =====================================================================

export function mockFills(instructionId: string): Fill[] {
  // 以 id 字符做简易哈希决定条数
  const hash = instructionId
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const n = (hash % 3) + 1
  const rng = makeRng(hash)
  return Array.from({ length: n }, (_, i) => {
    const basePrice = 1000 + (hash % 20000)
    return {
      id: `fill-${instructionId}-${i + 1}`,
      instruction_id: instructionId,
      filled_qty: 1 + Math.floor(rng() * 2),
      filled_price: Number((basePrice * (0.998 + rng() * 0.004)).toFixed(2)),
      filled_at: `${TODAY}T${String(2 + i).padStart(2, "0")}:${String(
        15 + i * 7,
      ).padStart(2, "0")}:00.000Z`,
      trigger_source: i === 0 ? "user_manual" : "stop_loss",
      note: i === 0 ? null : "盘中止损触发",
      created_at: `${TODAY}T${String(2 + i).padStart(2, "0")}:${String(
        15 + i * 7,
      ).padStart(2, "0")}:00.000Z`,
    }
  })
}

// =====================================================================
// mockPositions — 5 条
// =====================================================================

export function mockPositions(): Position[] {
  const rows: Array<
    [
      symbol: string,
      contract: string,
      qty: number,
      entry: number,
      stop: number | null,
      group: string,
      openedDays: number,
      last: number,
    ]
  > = [
    ["AO", "AO2505", 3, 15180, 14900, "黑色金属", 8, 15462],
    ["JD", "JD2505", 2, 3402, 3350, "农产品", 3, 3448],
    ["CF", "CF2605", -1, 13960, 14180, "软商品", 1, 13892],
    ["SA", "SA2605", 2, 1342, 1310, "化工", 5, 1361],
    ["AP", "AP2610", 1, 8580, 8480, "农产品", 12, 8614],
  ]

  return rows.map(([symbol, contract, qty, entry, stop, group, days, last]) => {
    const openedAt = new Date(Date.parse(TODAY) - days * 86400_000).toISOString()
    // 近似未实现盈亏（简化：price diff * qty * 10 作为展示单位）
    const pnl = Number(((last - entry) * qty * 10).toFixed(2))
    return {
      symbol,
      contract_code: contract,
      qty,
      avg_entry_price: entry,
      stop_loss_price: stop,
      group_name: group,
      opened_at: openedAt,
      last_updated_at: NOW_ISO,
      notes: null,
      last_price: last,
      unrealized_pnl: pnl,
    }
  })
}

// =====================================================================
// mockDailyPnl — 90 天权益曲线（100 万起，末日 +50%）
// =====================================================================

export function mockDailyPnl(days = 90): DailyPnl[] {
  const rng = makeRng(777)
  const start = 1_000_000
  const end = 1_500_000 // 末日 +50%
  const arr: DailyPnl[] = []
  let peak = start

  // 用 log-linear 趋势 + 小幅波动生成一条上升曲线
  const dailyTrend = Math.log(end / start) / (days - 1)
  let equity = start

  for (let i = 0; i < days; i++) {
    const noise = (rng() - 0.5) * 0.015 // ±0.75% 波动
    equity = equity * Math.exp(dailyTrend + noise)
    if (i === days - 1) equity = end // 钉住末日

    peak = Math.max(peak, equity)
    const dd = peak > 0 ? (equity - peak) / peak : 0 // 负数或 0
    const date = new Date(
      Date.parse(TODAY) - (days - 1 - i) * 86400_000,
    )
      .toISOString()
      .slice(0, 10)

    const prevEquity = i === 0 ? start : arr[i - 1].equity
    const pnlToday = Number((equity - prevEquity).toFixed(2))

    arr.push({
      date,
      equity: Number(equity.toFixed(2)),
      cash: Number((equity * 0.65).toFixed(2)),
      open_positions_mv: Number((equity * 0.35).toFixed(2)),
      realized_pnl_today: Number((pnlToday * 0.6).toFixed(2)),
      unrealized_pnl_today: Number((pnlToday * 0.4).toFixed(2)),
      soft_stop_triggered: false,
      drawdown_from_peak: Number(dd.toFixed(6)),
      peak_equity_to_date: Number(peak.toFixed(2)),
      notes: null,
      created_at: `${date}T16:00:00.000Z`,
      updated_at: `${date}T16:00:00.000Z`,
    })
  }
  return arr
}

// =====================================================================
// mockAlerts — 10 条混合 severity
// =====================================================================

export function mockAlerts(): Alert[] {
  const base: Array<[Alert["severity"], string, string]> = [
    ["critical", "soft_stop", "日内回撤 4.2% 触达 soft stop，今日禁止新开仓"],
    ["warn", "data_pipeline", "AG2606 收盘价数据缺失，已用昨日 settle 补齐"],
    ["info", "signal_generated", "日盘信号生成完毕：8 条指令"],
    ["warn", "veto_rate", "本周人工否决率 18%，高于基线 8%"],
    ["info", "fill_posted", "CF2605 已全部成交（1 手 @ 13892）"],
    ["critical", "stop_loss_hit", "SP2507 空头止损触发，-¥24,800"],
    ["info", "roll_contract", "AO2505 将于 5 个交易日后移仓至 AO2509"],
    ["warn", "drawdown", "账户回撤 2.8%，距 soft stop 阈值 1.2%"],
    ["info", "data_refresh", "历史 K 线 22 列完整性校验通过"],
    ["info", "account_snapshot", "每日结算完成：权益 ¥1,500,000"],
  ]

  return base.map(([severity, event_type, message], i) => ({
    id: 10000 + i,
    event_at: new Date(
      Date.parse(NOW_ISO) - i * 37 * 60_000,
    ).toISOString(),
    severity,
    event_type,
    message,
    payload: null,
  }))
}

// =====================================================================
// mockDailyReport(date)
// =====================================================================

export function mockDailyReport(date: string): DailyReport {
  const pnlSeries = mockDailyPnl(90)
  const daily =
    pnlSeries.find((d) => d.date === date) ?? pnlSeries[pnlSeries.length - 1]
  const prev = pnlSeries[pnlSeries.length - 2]
  const pnlToday = daily.equity - prev.equity
  const pnlCumulative = daily.equity - pnlSeries[0].equity

  return {
    date,
    daily_pnl: daily,
    kpi: {
      pnl_today: Number(pnlToday.toFixed(2)),
      pnl_cumulative: Number(pnlCumulative.toFixed(2)),
      sharpe: 1.08,
      max_drawdown: -0.082,
      trade_count_today: 5,
      veto_count_today: 1,
    },
    instructions_summary: {
      pending: 3,
      fully_filled: 1,
      partially_filled: 1,
      vetoed: 1,
      skipped: 1,
      expired: 1,
    },
    vetoed_list: [
      {
        symbol: "SP",
        contract_code: "SP2507",
        reason: "盘前公告突发，价格跳空，暂不建仓",
      },
      {
        symbol: "AG",
        contract_code: "AG2606",
        reason: "政策风险事件窗口，暂停新仓一天",
      },
    ],
  }
}

// =====================================================================
// mockAnalyticsBreakdown
// =====================================================================

export function mockAnalyticsBreakdown(): AnalyticsBreakdown {
  const rng = makeRng(314)
  const makeMini = (bias: number) =>
    Array.from({ length: 10 }, (_, i) => ({
      idx: i + 1,
      pnl: Number(((rng() - 0.5 + bias * 0.15) * 10000).toFixed(2)),
    }))

  const by_symbol = [
    { symbol: "AO", group_name: "黑色金属", pnl_cumulative: 142_800, win_rate: 0.62, trade_count: 24, recent_pnl_series: makeMini(1) },
    { symbol: "SA", group_name: "化工", pnl_cumulative: 98_400, win_rate: 0.55, trade_count: 38, recent_pnl_series: makeMini(0.8) },
    { symbol: "CF", group_name: "软商品", pnl_cumulative: 76_100, win_rate: 0.58, trade_count: 21, recent_pnl_series: makeMini(0.6) },
    { symbol: "JD", group_name: "农产品", pnl_cumulative: 54_300, win_rate: 0.50, trade_count: 30, recent_pnl_series: makeMini(0.3) },
    { symbol: "AP", group_name: "农产品", pnl_cumulative: 28_700, win_rate: 0.48, trade_count: 18, recent_pnl_series: makeMini(0.1) },
    { symbol: "FG", group_name: "化工", pnl_cumulative: -12_400, win_rate: 0.42, trade_count: 26, recent_pnl_series: makeMini(-0.4) },
    { symbol: "SH", group_name: "化工", pnl_cumulative: -28_900, win_rate: 0.40, trade_count: 22, recent_pnl_series: makeMini(-0.7) },
    { symbol: "SP", group_name: "有色", pnl_cumulative: -46_200, win_rate: 0.38, trade_count: 14, recent_pnl_series: makeMini(-0.9) },
  ]

  const by_group = [
    {
      group_name: "黑色金属",
      pnl_cumulative: 142_800,
      symbols: [
        { symbol: "AO", weight: 0.65, pnl: 142_800 },
        { symbol: "RB", weight: 0.35, pnl: 0 },
      ],
    },
    {
      group_name: "化工",
      pnl_cumulative: 57_100,
      symbols: [
        { symbol: "SA", weight: 0.45, pnl: 98_400 },
        { symbol: "FG", weight: 0.30, pnl: -12_400 },
        { symbol: "SH", weight: 0.25, pnl: -28_900 },
      ],
    },
    {
      group_name: "农产品",
      pnl_cumulative: 83_000,
      symbols: [
        { symbol: "JD", weight: 0.6, pnl: 54_300 },
        { symbol: "AP", weight: 0.4, pnl: 28_700 },
      ],
    },
    {
      group_name: "软商品",
      pnl_cumulative: 76_100,
      symbols: [{ symbol: "CF", weight: 1, pnl: 76_100 }],
    },
    {
      group_name: "有色",
      pnl_cumulative: -46_200,
      symbols: [{ symbol: "SP", weight: 1, pnl: -46_200 }],
    },
  ]

  return { by_symbol, by_group }
}

// =====================================================================
// 工具：格式化
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
