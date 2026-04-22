/**
 * app/formulas/page.tsx —— 风险与公式可视化页（RSC 外壳）
 *
 * 背景（2026-04-20）：
 *   用户需要一眼看清系统里所有"亏损/风险/权益/回撤/cap"的计算公式，
 *   以及**每个公式代入当前实盘数字的具体值**。目的是让用户随时可以
 *   验证"为什么这笔指令手数是 2 不是 3"之类的问题。
 *
 * 数据源：
 *   - /api/formulas-context：配置常量 + 账户实时 + 持仓聚合（B 定义）
 *   - /api/universe：用 AO 举例 Card 1 单手风险 + 手数计算
 *   - /api/positions：Card 2 / Card 3 / Card 5 持仓逐条代入
 */
import {
  fetchFormulasContext,
  fetchOrMock,
  fetchPositions,
  fetchUniverse,
} from "@/lib/api"
import { mockPositions, mockUniverse } from "@/lib/mock"
import { MockBanner } from "@/components/mock-banner"
import type { FormulasContext } from "@/lib/types"
import { FormulasView } from "./formulas-view.client"

/** 骨架值 —— 后端不可达时填充。 */
function emptyFormulasContext(): FormulasContext {
  return {
    initial_capital: 250000,
    risk_per_trade: 0.03,
    portfolio_risk_cap: 0.2,
    group_risk_cap_default: 0.08,
    max_portfolio_leverage: 3.0,
    soft_stop_pct: 0.07,
    soft_stop_enabled: false,
    unrealized_exposure_soft_cap: 0.4,
    stop_atr_mult: 2.0,
    atr_period: 20,
    equity: null,
    cash: null,
    peak_equity: null,
    drawdown_from_peak: null,
    snapshot_date: null,
    risk_budget_per_trade: 7500,
    portfolio_cap_amount: 50000,
    group_cap_default_amount: 20000,
    leverage_cap_amount: 750000,
    positions_count: 0,
    total_principal_risk: 0,
    total_unrealized_exposure: 0,
    total_notional: 0,
    current_leverage: 0,
  }
}

export default async function FormulasPage() {
  // 并发拉三路数据；任一失败都独立降级
  const [ctxRes, univRes, posRes] = await Promise.all([
    fetchOrMock(() => fetchFormulasContext(), () => emptyFormulasContext()),
    fetchOrMock(() => fetchUniverse(), () => mockUniverse()),
    fetchOrMock(() => fetchPositions(), () => mockPositions()),
  ])

  const anyMock = ctxRes.isMock || univRes.isMock || posRes.isMock
  const reason = ctxRes.error ?? univRes.error ?? posRes.error

  return (
    <>
      {anyMock && <MockBanner reason={reason} />}
      <FormulasView
        ctx={ctxRes.data}
        universe={univRes.data}
        positions={posRes.data}
      />
    </>
  )
}
