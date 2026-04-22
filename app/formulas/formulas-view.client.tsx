"use client"

/**
 * app/formulas/formulas-view.client.tsx —— 风险与公式可视化展示组件
 *
 * 7 张 Card，每张 Card 统一模板：
 *   [标题] [公式 <pre>] [配置常量小表] [当前真实代入 (绿色)] [中文解读]
 *
 * 设计准则：
 *   - 公式块 <pre><code> monospace，不引入 KaTeX 避免新依赖
 *   - 代入值 text-green-600 / dark:text-green-400 凸显
 *   - lg:grid-cols-2 并列 2 栏响应式
 *   - 每张 Card 标题带一个小 Badge 方便快速定位类别
 */
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import type {
  FormulasContext,
  Position,
  UniverseSymbol,
} from "@/lib/types"
import { formatCurrency, formatPct } from "@/lib/mock"

// ---------- 小工具 ----------

/** Decimal|null → number，null/NaN → 0。 */
function toNum(v: number | string | null | undefined): number {
  if (v == null) return 0
  if (typeof v === "number") return v
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** 百分比展示，保留 2 位。 */
function pct(n: number): string {
  return `${(n * 100).toFixed(2)}%`
}

/** 金额精确展示（带千分位；可选带符号）。 */
function fmtMoney(n: number): string {
  return formatCurrency(n)
}

// 组名中英映射（Card 4 解读里用）
const GROUP_LABELS: Record<string, string> = {
  building: "建材",
  livestock: "畜牧",
  ind_AP: "苹果",
  ind_BB: "胶合板",
  ind_FB: "纤维板",
  rubber_fiber: "橡胶 / 棉花",
}

// ---------- 通用子组件 ----------

/** 公式代码块（<pre><code>；等宽字体；边框灰底）。 */
function FormulaBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
      <code>{children}</code>
    </pre>
  )
}

/** 两列 KV 小表（配置常量展示用）。 */
function KvRow({
  label,
  value,
  hint,
}: {
  label: string
  value: React.ReactNode
  hint?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-xs border-b border-border/50 py-1 last:border-b-0">
      <div className="text-muted-foreground">
        {label}
        {hint && (
          <span className="ml-2 font-mono text-[10px] opacity-70">{hint}</span>
        )}
      </div>
      <div className="font-mono">{value}</div>
    </div>
  )
}

/** "当前真实代入"绿色展示块。 */
function SubstitutionBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/40 p-3 space-y-1 font-mono text-xs leading-relaxed text-green-700 dark:text-green-300">
      {children}
    </div>
  )
}

/** 标准 Card 标题前缀 Badge。 */
function CardNumberBadge({ n }: { n: number }) {
  return (
    <Badge variant="outline" className="font-mono">
      Card {n}
    </Badge>
  )
}

// =====================================================================
// 主视图
// =====================================================================

export function FormulasView({
  ctx,
  universe,
  positions,
}: {
  ctx: FormulasContext
  universe: UniverseSymbol[]
  positions: Position[]
}) {
  // 数值解包（Decimal 字符串 → number）
  const initialCapital = toNum(ctx.initial_capital)
  const equity = ctx.equity != null ? toNum(ctx.equity) : initialCapital
  const cash = ctx.cash != null ? toNum(ctx.cash) : initialCapital
  const peak = ctx.peak_equity != null ? toNum(ctx.peak_equity) : null
  const drawdown =
    ctx.drawdown_from_peak != null ? toNum(ctx.drawdown_from_peak) : null
  const riskBudget = toNum(ctx.risk_budget_per_trade)
  const portfolioCap = toNum(ctx.portfolio_cap_amount)
  const groupCap = toNum(ctx.group_cap_default_amount)
  const leverageCap = toNum(ctx.leverage_cap_amount)
  const totalPrincipalRisk = toNum(ctx.total_principal_risk)
  const totalUnreal = toNum(ctx.total_unrealized_exposure)
  const totalNotional = toNum(ctx.total_notional)
  const currentLeverage = toNum(ctx.current_leverage)

  // Card 1 举例品种：universe 第 1 个可交易品种（tradeable_250k）；否则用第一个
  const exampleU =
    universe.find((u) => u.tradeable_250k) ?? universe[0] ?? null
  // 反推 ATR20：single_contract_risk = 2 × ATR20 × multiplier
  const exSymbol = exampleU?.symbol ?? "—"
  const exMult = toNum(exampleU?.contract_multiplier)
  const exSingleRisk = toNum(exampleU?.single_contract_risk)
  const exAtr20 =
    exMult > 0 && exSingleRisk > 0
      ? exSingleRisk / (2 * exMult)
      : 0
  const exSettle = toNum(exampleU?.last_settle)
  const exTargetQty =
    exSingleRisk > 0 ? Math.floor(riskBudget / exSingleRisk) : 0
  const exNotional = exSettle * exMult

  // Card 4：当前各类 cap 使用量
  const portfolioUsage =
    portfolioCap > 0 ? totalPrincipalRisk / portfolioCap : 0
  const leverageUsage = leverageCap > 0 ? totalNotional / leverageCap : 0

  // Card 5：浮盈暴露软阈值使用量
  const softCapRatio = ctx.unrealized_exposure_soft_cap
  const softCapAmount = equity * softCapRatio
  const softCapUsage = softCapAmount > 0 ? totalUnreal / softCapAmount : 0

  // Card 3：每笔持仓 principal_risk 明细
  const principalRisksByPos = positions.map((p) => {
    const qty = p.qty
    const absQty = Math.abs(qty)
    const dirSign = qty > 0 ? 1 : -1
    const entry = toNum(p.avg_entry_price)
    const stop = p.stop_loss_price != null ? toNum(p.stop_loss_price) : null
    const last = p.last_price != null ? toNum(p.last_price) : null
    const mult = toNum(p.contract_multiplier)
    const diff = stop != null ? Math.max((entry - stop) * dirSign, 0) : 0
    const principal = stop != null ? diff * mult * absQty : 0
    const floatDiff =
      stop != null && last != null
        ? Math.max((last - stop) * dirSign, 0)
        : 0
    const floatingExposure =
      stop != null && last != null ? floatDiff * mult * absQty : 0
    return {
      symbol: p.symbol,
      direction: qty > 0 ? "多" : "空",
      qty,
      entry,
      stop,
      last,
      mult,
      principal,
      floatingExposure,
    }
  })

  return (
    <div className="p-6 space-y-6">
      {/* ---------- 页头 ---------- */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">风险与公式</h1>
        <p className="text-sm text-muted-foreground mt-1">
          本页列出系统中所有"亏损 / 风险 / 权益 / 回撤 / cap"的计算公式，
          并代入**当前实盘数字**让你可以手工核对"为什么这笔指令手数是 2 不是 3"。
        </p>
        <div className="mt-3 flex flex-wrap items-baseline gap-3 text-xs">
          <span className="text-muted-foreground">账户权益</span>
          <span className="font-mono text-lg font-semibold text-green-700 dark:text-green-300">
            {fmtMoney(equity)}
          </span>
          <span className="text-muted-foreground">/ 持仓数</span>
          <span className="font-mono">{ctx.positions_count}</span>
          {ctx.snapshot_date && (
            <span className="text-muted-foreground">
              / 快照 {ctx.snapshot_date}
            </span>
          )}
          <span className="text-muted-foreground">
            / 初始资金 {fmtMoney(initialCapital)}
          </span>
        </div>
      </div>

      {/* ---------- Cards 两列网格 ---------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* -------------------- Card 1 单手风险 + 手数计算 -------------------- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CardNumberBadge n={1} />
              <span>单手风险 + 手数计算</span>
            </CardTitle>
            <CardDescription>
              Engine 给每笔交易分配 {pct(ctx.risk_per_trade)} 账户预算作 risk；
              若单手风险 &gt; 预算则 QTY_LT_1 拒绝开仓
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <FormulaBlock>
{`single_contract_risk = stop_atr_mult × ATR${ctx.atr_period} × multiplier
target_qty           = floor(risk_per_trade × equity / single_contract_risk)`}
            </FormulaBlock>

            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1">
                配置常量
              </div>
              <KvRow
                label="stop_atr_mult"
                value={ctx.stop_atr_mult}
                hint="ATR 倍数"
              />
              <KvRow
                label="atr_period"
                value={ctx.atr_period}
                hint="ATR 周期"
              />
              <KvRow
                label="risk_per_trade"
                value={pct(ctx.risk_per_trade)}
                hint="单笔风险"
              />
            </div>

            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1">
                当前代入（举例品种 {exSymbol}）
              </div>
              <SubstitutionBlock>
                {exampleU ? (
                  <>
                    <div>
                      ATR20({exSymbol}) ≈ {exAtr20.toFixed(2)}（由
                      single_contract_risk {fmtMoney(exSingleRisk)} / (2 ×
                      mult {exMult}) 反推）
                    </div>
                    <div>
                      single_contract_risk = 2 × {exAtr20.toFixed(2)} ×{" "}
                      {exMult} = {fmtMoney(exSingleRisk)}
                    </div>
                    <div>
                      target_qty = floor({pct(ctx.risk_per_trade)} ×{" "}
                      {fmtMoney(equity)} / {fmtMoney(exSingleRisk)}) = floor(
                      {fmtMoney(riskBudget)} / {fmtMoney(exSingleRisk)}) ={" "}
                      <span className="font-bold">{exTargetQty} 手</span>
                    </div>
                  </>
                ) : (
                  <div>universe 数据缺失，无法举例代入</div>
                )}
              </SubstitutionBlock>
            </div>
          </CardContent>
        </Card>

        {/* -------------------- Card 2 浮动盈亏 + 权益 -------------------- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CardNumberBadge n={2} />
              <span>浮动盈亏 + 账户权益</span>
            </CardTitle>
            <CardDescription>
              期货 mark-to-market：每日按 settle 价 unrealize；equity 等于
              initial_capital + 浮盈累计（一期未计入已实现 PnL）
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <FormulaBlock>
{`unrealized_pnl = (current_settle - avg_entry_price) × qty × multiplier
equity         = initial_capital + Σ unrealized_pnl
cash           = equity - Σ |qty| × current_settle × multiplier`}
            </FormulaBlock>

            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1">
                配置常量
              </div>
              <KvRow
                label="initial_capital"
                value={fmtMoney(initialCapital)}
                hint="live/.env"
              />
            </div>

            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1">
                当前代入
              </div>
              <SubstitutionBlock>
                {positions.length === 0 ? (
                  <>
                    <div>账户当前空仓（positions_count = 0）</div>
                    <div>
                      Σ unrealized_pnl = ¥0；equity = initial_capital ={" "}
                      {fmtMoney(initialCapital)}
                    </div>
                    <div>cash = {fmtMoney(cash)}</div>
                  </>
                ) : (
                  <>
                    {positions.slice(0, 4).map((p) => {
                      const entry = toNum(p.avg_entry_price)
                      const last =
                        p.last_price != null ? toNum(p.last_price) : null
                      const mult = toNum(p.contract_multiplier)
                      const unreal =
                        last != null && mult > 0
                          ? (last - entry) * p.qty * mult
                          : 0
                      return (
                        <div key={`${p.symbol}-${p.contract_code}`}>
                          {p.symbol}({p.qty > 0 ? "多" : "空"} {Math.abs(p.qty)}{" "}
                          手): ({last ?? "—"} − {entry}) × {p.qty} × {mult} ={" "}
                          <span
                            className={
                              unreal >= 0
                                ? "text-green-700 dark:text-green-300"
                                : "text-red-600 dark:text-red-400"
                            }
                          >
                            {fmtMoney(unreal)}
                          </span>
                        </div>
                      )
                    })}
                    <div>equity = {fmtMoney(equity)}</div>
                    <div>cash = {fmtMoney(cash)}</div>
                  </>
                )}
              </SubstitutionBlock>
            </div>
          </CardContent>
        </Card>

        {/* -------------------- Card 3 风险定义 B -------------------- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CardNumberBadge n={3} />
              <span>风险定义 B（2026-04-20 改）</span>
            </CardTitle>
            <CardDescription>
              principal_risk = 仓位被打到止损时相对 entry 的本金损失
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <FormulaBlock>
{`# long 方向
principal_risk = max(entry_fill - active_stop, 0) × multiplier × qty

# short 方向
principal_risk = max(active_stop - entry_fill, 0) × multiplier × qty`}
            </FormulaBlock>

            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1">
                当前代入（每笔持仓明细）
              </div>
              <SubstitutionBlock>
                {positions.length === 0 ? (
                  <div>
                    当前 0 持仓，Σ principal_risk = ¥0
                  </div>
                ) : (
                  <>
                    {principalRisksByPos.map((r) => (
                      <div key={r.symbol}>
                        {r.symbol}({r.direction} {Math.abs(r.qty)} 手): max(
                        {r.entry.toFixed(2)} − {r.stop?.toFixed(2) ?? "—"},
                        0) × {r.mult} × {Math.abs(r.qty)} ={" "}
                        <span className="font-bold">
                          {fmtMoney(r.principal)}
                        </span>
                      </div>
                    ))}
                    <div className="pt-1 border-t border-green-300/40">
                      Σ principal_risk ={" "}
                      <span className="font-bold">
                        {fmtMoney(totalPrincipalRisk)}
                      </span>
                    </div>
                  </>
                )}
              </SubstitutionBlock>
            </div>

            <div className="space-y-1 text-xs text-muted-foreground">
              <div>
                1. 定义 B：仓位被打到止损时相对 entry 的本金损失
              </div>
              <div>
                2. stop trail 过 entry 后 risk = 0（赢家释放预算，不占用 cap）
              </div>
              <div>
                3. 对比旧 C 定义（current − stop）：B 下 Sharpe +30%，MaxDD
                改善
              </div>
            </div>
          </CardContent>
        </Card>

        {/* -------------------- Card 4 Portfolio / Group / Leverage 三层 cap -------------------- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CardNumberBadge n={4} />
              <span>Portfolio / Group / Leverage 三层 cap</span>
            </CardTitle>
            <CardDescription>
              三个 cap 任一击穿 → reject 该开仓单，日志 reject_reason 记录
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <FormulaBlock>
{`Σ principal_risk          ≤ portfolio_risk_cap × equity     # 硬约束
Σ principal_risk_by_group ≤ group_risk_cap × equity         # 硬约束
Σ |qty| × price × mult    ≤ max_portfolio_leverage × equity # 硬约束（实盘最常拒单，77%）`}
            </FormulaBlock>

            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1">
                配置常量
              </div>
              <KvRow
                label="portfolio_risk_cap"
                value={pct(ctx.portfolio_risk_cap)}
              />
              <KvRow
                label="group_risk_cap_default"
                value={pct(ctx.group_risk_cap_default)}
                hint="final_v3 所有 6 组统一 0.08"
              />
              <KvRow
                label="max_portfolio_leverage"
                value={`${ctx.max_portfolio_leverage.toFixed(1)}×`}
              />
            </div>

            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1">
                当前代入
              </div>
              <SubstitutionBlock>
                <div>
                  portfolio_cap = {pct(ctx.portfolio_risk_cap)} ×{" "}
                  {fmtMoney(equity)} = {fmtMoney(portfolioCap)}
                </div>
                <div>
                  group_cap = {pct(ctx.group_risk_cap_default)} ×{" "}
                  {fmtMoney(equity)} = {fmtMoney(groupCap)}
                </div>
                <div>
                  leverage_cap = {ctx.max_portfolio_leverage.toFixed(1)}× ×{" "}
                  {fmtMoney(equity)} = {fmtMoney(leverageCap)}
                </div>
                <div className="pt-1 border-t border-green-300/40">
                  portfolio 已用 = {fmtMoney(totalPrincipalRisk)} /{" "}
                  {fmtMoney(portfolioCap)} ={" "}
                  <span
                    className={
                      portfolioUsage >= 1
                        ? "font-bold text-red-600 dark:text-red-400"
                        : "font-bold"
                    }
                  >
                    {formatPct(portfolioUsage)}
                  </span>
                </div>
                <div>
                  leverage 已用 = {fmtMoney(totalNotional)} /{" "}
                  {fmtMoney(leverageCap)} ={" "}
                  <span
                    className={
                      leverageUsage >= 1
                        ? "font-bold text-red-600 dark:text-red-400"
                        : "font-bold"
                    }
                  >
                    {formatPct(leverageUsage)}
                  </span>{" "}
                  （当前实盘最常拒单原因）
                </div>
              </SubstitutionBlock>
            </div>
          </CardContent>
        </Card>

        {/* -------------------- Card 5 浮盈暴露软约束 -------------------- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CardNumberBadge n={5} />
              <span>浮盈暴露软约束（B 新增）</span>
            </CardTitle>
            <CardDescription>
              log-only：监控 B 定义的理论盲区（赢家释放 cap 后浮盈回吐风险），
              击穿 warn 不 reject
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <FormulaBlock>
{`# long 方向
unrealized_exposure = max(current - active_stop, 0) × multiplier × qty

# 软上限（log-only，不 reject）
Σ unrealized_exposure > unrealized_exposure_soft_cap × equity  ⇒ logger.warning`}
            </FormulaBlock>

            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1">
                配置常量
              </div>
              <KvRow
                label="unrealized_exposure_soft_cap"
                value={pct(softCapRatio)}
                hint="~2× 硬 cap"
              />
            </div>

            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1">
                当前代入
              </div>
              <SubstitutionBlock>
                <div>
                  soft_cap_amount = {pct(softCapRatio)} × {fmtMoney(equity)} ={" "}
                  {fmtMoney(softCapAmount)}
                </div>
                <div>
                  Σ unrealized_exposure = {fmtMoney(totalUnreal)} (
                  {positions.length} 笔持仓)
                </div>
                <div className="pt-1 border-t border-green-300/40">
                  使用率 = {fmtMoney(totalUnreal)} / {fmtMoney(softCapAmount)} ={" "}
                  <span
                    className={
                      softCapUsage >= 1
                        ? "font-bold text-red-600 dark:text-red-400"
                        : "font-bold"
                    }
                  >
                    {formatPct(softCapUsage)}
                  </span>{" "}
                  {softCapUsage >= 1 ? "(击穿 → warn)" : "(未击穿)"}
                </div>
              </SubstitutionBlock>
            </div>
          </CardContent>
        </Card>

        {/* -------------------- Card 6 Drawdown + Soft stop -------------------- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CardNumberBadge n={6} />
              <span>Drawdown + Soft stop</span>
            </CardTitle>
            <CardDescription>
              soft_stop 触发则 signal_service 下一轮过滤 open/add 指令只保留 close
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <FormulaBlock>
{`peak_equity          = max(所有历史 equity ∪ today)
drawdown_from_peak   = (peak_equity - current_equity) / peak_equity
soft_stop_triggered  = drawdown_from_peak > soft_stop_pct  (一期 DISABLED)`}
            </FormulaBlock>

            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1">
                配置常量
              </div>
              <KvRow
                label="soft_stop_pct"
                value={pct(ctx.soft_stop_pct)}
                hint="日内回撤熔断阈值"
              />
              <KvRow
                label="soft_stop_enabled"
                value={
                  <Badge
                    variant={ctx.soft_stop_enabled ? "default" : "outline"}
                    className={
                      ctx.soft_stop_enabled
                        ? "bg-amber-100 text-amber-700"
                        : ""
                    }
                  >
                    {ctx.soft_stop_enabled ? "ENABLED" : "DISABLED"}
                  </Badge>
                }
                hint="一期关闭"
              />
            </div>

            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1">
                当前代入
              </div>
              <SubstitutionBlock>
                <div>
                  current equity = {fmtMoney(equity)}
                  {ctx.snapshot_date && ` (${ctx.snapshot_date} 快照)`}
                </div>
                <div>
                  peak_equity = {peak != null ? fmtMoney(peak) : "（无历史记录）"}
                </div>
                <div>
                  drawdown_from_peak ={" "}
                  {drawdown != null ? (
                    <span
                      className={
                        drawdown > ctx.soft_stop_pct
                          ? "font-bold text-red-600 dark:text-red-400"
                          : "font-bold"
                      }
                    >
                      {pct(drawdown)}
                    </span>
                  ) : (
                    "0.00%（无历史）"
                  )}{" "}
                  vs 阈值 {pct(ctx.soft_stop_pct)}
                </div>
                <div>
                  soft_stop 状态:{" "}
                  {ctx.soft_stop_enabled ? (
                    drawdown != null && drawdown > ctx.soft_stop_pct ? (
                      <span className="font-bold text-red-600 dark:text-red-400">
                        TRIGGERED
                      </span>
                    ) : (
                      "未触发"
                    )
                  ) : (
                    "DISABLED（一期关闭，永不触发）"
                  )}
                </div>
              </SubstitutionBlock>
            </div>
          </CardContent>
        </Card>

        {/* -------------------- Card 7 单手名义价值 -------------------- */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CardNumberBadge n={7} />
              <span>单手名义价值（辅助理解）</span>
            </CardTitle>
            <CardDescription>
              notional 越大越难在 25 万本金下开 1 手，单手名义价值超过
              leverage_cap 的品种即便定义 B 下也容易 QTY_LT_1
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <FormulaBlock>
{`notional_per_contract = current_settle × multiplier`}
            </FormulaBlock>

            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1">
                当前代入（universe {universe.length} 品种，按名义升序）
              </div>
              <SubstitutionBlock>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                  {[...universe]
                    .map((u) => ({
                      symbol: u.symbol,
                      price: toNum(u.last_settle),
                      mult: toNum(u.contract_multiplier),
                      notional: toNum(u.last_settle) * toNum(u.contract_multiplier),
                      tradeable: u.tradeable_250k,
                      group: u.group_name,
                    }))
                    .sort((a, b) => a.notional - b.notional)
                    .map((u) => (
                      <div
                        key={u.symbol}
                        className={
                          u.tradeable
                            ? ""
                            : "opacity-60"
                        }
                      >
                        {u.symbol} ({GROUP_LABELS[u.group] ?? u.group}){" "}
                        {u.price.toLocaleString("zh-CN")} × {u.mult} ={" "}
                        <span className="font-bold">
                          {fmtMoney(u.notional)} / 手
                        </span>
                        {!u.tradeable && (
                          <span className="text-red-600 dark:text-red-400 ml-1">
                            超阈值
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              </SubstitutionBlock>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ---------- 结语 ---------- */}
      <Separator />
      <div className="text-xs text-muted-foreground leading-relaxed">
        <p>
          配置源：<code>live/config.py</code> +{" "}
          <code>live/signal_service.py::build_engine_cfg_for_live</code> +{" "}
          <code>strats/engine_config.py::EngineConfig</code> 默认。
        </p>
        <p>
          代入值源：<code>/api/formulas-context</code>（equity / 配置） +{" "}
          <code>/api/universe</code>（Card 1 / Card 7 举例） +{" "}
          <code>/api/positions</code>（Card 2 / Card 3 / Card 5 逐笔）。
        </p>
        <p>
          实时性：<code>equity</code> 来自{" "}
          <code>daily_pnl</code> 表最新一行（每日 15:30 日盘结算后
          launchd 写入）。
        </p>
      </div>
    </div>
  )
}
