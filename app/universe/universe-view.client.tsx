"use client"

/**
 * app/universe/universe-view.client.tsx — 盯盘品种清单展示组件。
 *
 * 数据来自 /api/universe（final_v3 配置 13 品种融合快照）。
 * 布局：
 *   - 顶部 3 张 KPI 卡（总数 / 25 万下可交易数 / 当前持仓数）
 *   - 按 group 聚合分组渲染（每组一张表）
 *     - tradeable_250k=false → 行加灰底 + 超阈值 badge
 *     - in_position=true     → 品种列带链接跳到 /positions
 */
import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatDate } from "@/lib/mock"
import type { UniverseSymbol } from "@/lib/types"

// 组 group_name → 中文标签（sidebar / header 同时用）
const GROUP_LABELS: Record<string, string> = {
  building: "建材",
  livestock: "畜牧",
  ind_AP: "苹果",
  ind_BB: "胶合板",
  ind_FB: "纤维板",
  rubber_fiber: "橡胶 / 棉花",
}

function groupLabel(name: string): string {
  return GROUP_LABELS[name] ?? name
}

/** 把可能是 string|number|null 的 Decimal 字段转 number（null → 0）。 */
function toNum(v: number | string | null | undefined): number {
  if (v == null) return 0
  if (typeof v === "number") return v
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// reject 原因中文解释（给用户看）
const REJECT_LABELS: Record<string, string> = {
  PORTFOLIO_RISK_CAP: "组合风控已满",
  GROUP_RISK_CAP: "同组风控已满",
  INDEPENDENT_SOFT_CAP: "独立组合计已满",
  LEVERAGE_CAP: "杠杆上限",
  MARGIN_CAP: "保证金占用上限",
  QTY_LT_1: "按风控算出不足 1 手",
  ATR_BELOW_FLOOR: "ATR 过低（限价锁定日）",
  CONGESTION_LOCKED: "震荡行情 filter 拦截",
  ALREADY_IN_POSITION: "已有持仓",
  PENDING_ENTRY_EXISTS: "已有待成交指令",
  SYMBOL_LOCKED: "该品种已被其他策略占用",
  WARMUP_INSUFFICIENT: "指标热身期不足",
  NO_NEXT_TRADE_DATE: "交易日历未覆盖次日",
  NON_POSITIVE_RISK: "计算得 risk ≤ 0",
}

function renderSignalBadge(u: UniverseSymbol) {
  // 未跑过 signal_service
  if (!u.last_session_date) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  // 没有 trigger（市场没机会）— 显示具体原因
  if (!u.last_entry_trigger) {
    const detail = u.last_miss_reason
    if (detail) {
      return (
        <span
          className="text-xs text-muted-foreground leading-tight block max-w-[360px]"
          title={`${u.last_session_date} ${u.last_session}\n${detail}`}
        >
          {detail}
        </span>
      )
    }
    return (
      <span
        className="text-xs text-muted-foreground"
        title={`最近一次 ${u.last_session_date} ${u.last_session} engine 未判定入场条件`}
      >
        无信号
      </span>
    )
  }
  // trigger 了且通过（应当产生了 pending instruction）
  const dirLabel = u.last_entry_direction === 1 ? "做多"
    : u.last_entry_direction === -1 ? "做空" : ""
  if (!u.last_reject_reason) {
    return (
      <Badge className="bg-blue-100 text-blue-800 border-transparent dark:bg-blue-950 dark:text-blue-300">
        ✓ 已入场 {dirLabel}
      </Badge>
    )
  }
  // trigger 了但被风控拒
  const labelZh = REJECT_LABELS[u.last_reject_reason] ?? u.last_reject_reason
  return (
    <Badge
      variant="outline"
      className="border-amber-400 text-amber-700 dark:text-amber-300"
      title={`${u.last_session_date} ${u.last_session} · ${dirLabel} · ${u.last_reject_reason}`}
    >
      ⚠ {dirLabel} 拒：{labelZh}
    </Badge>
  )
}

export function UniverseView({ universe }: { universe: UniverseSymbol[] }) {
  const total = universe.length
  const tradeable = universe.filter((u) => u.tradeable_250k).length
  const inPosition = universe.filter((u) => u.in_position).length

  // 按 group 聚合；保持后端顺序（building/ind_AP/ind_BB/ind_FB/livestock/rubber_fiber）
  const groups: { name: string; items: UniverseSymbol[] }[] = []
  const seen = new Map<string, number>()
  for (const u of universe) {
    const idx = seen.get(u.group_name)
    if (idx === undefined) {
      seen.set(u.group_name, groups.length)
      groups.push({ name: u.group_name, items: [u] })
    } else {
      groups[idx].items.push(u)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">盯盘品种</h1>
        <p className="text-sm text-muted-foreground mt-1">
          final_v3 配置共 {total} 个品种，其中 {tradeable} 个在 25 万本金下可开仓；
          当前持仓 {inPosition} 个。阈值：单手风险 ≤ 7,500 元（25 万 × 3%）。
        </p>
      </div>

      {/* 顶部 3 张 KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardDescription>盯盘品种总数</CardDescription>
            <CardTitle className="text-2xl font-bold">{total}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              final_v3 配置 6 组共 {total} 品种
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>25 万可交易</CardDescription>
            <CardTitle className="text-2xl font-bold text-green-600 dark:text-green-400">
              {tradeable} / {total}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              单手风险 ≤ 7,500 元视为可开仓
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>当前持仓</CardDescription>
            <CardTitle className="text-2xl font-bold">{inPosition}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              点击品种名跳转至持仓详情
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 按 group 分组表格 */}
      {groups.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            暂无盯盘品种数据（后端可能尚未返回 /api/universe）
          </CardContent>
        </Card>
      )}

      {groups.map((g) => {
        const combo = g.items[0]?.combo ?? ""
        return (
          <Card key={g.name}>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <span>{groupLabel(g.name)}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {g.name}
                </span>
                {combo && (
                  <Badge variant="outline" className="font-mono">
                    {combo}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                该组共 {g.items.length} 品种；使用策略组合 {combo || "—"}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">品种</TableHead>
                    <TableHead>主力合约</TableHead>
                    <TableHead className="text-right">最新结算价</TableHead>
                    <TableHead>数据日期</TableHead>
                    <TableHead className="text-right">合约乘数</TableHead>
                    <TableHead className="text-right">单手风险</TableHead>
                    <TableHead>25 万可交易</TableHead>
                    <TableHead>今日信号</TableHead>
                    <TableHead className="pr-4">当前持仓</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.items.map((u) => {
                    const price = toNum(u.last_settle)
                    const mult = toNum(u.contract_multiplier)
                    const risk = toNum(u.single_contract_risk)
                    const rowClass = u.tradeable_250k
                      ? ""
                      : "bg-zinc-50 dark:bg-zinc-900/40 text-muted-foreground"
                    return (
                      <TableRow key={u.symbol} className={rowClass}>
                        <TableCell className="pl-4 font-medium">
                          {u.in_position ? (
                            <Link
                              href="/positions"
                              className="text-blue-600 dark:text-blue-400 hover:underline"
                              title="跳转至当前持仓详情"
                            >
                              {u.symbol}
                            </Link>
                          ) : (
                            u.symbol
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {u.contract_code ?? "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {price > 0 ? price.toLocaleString("zh-CN") : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {u.last_settle_date
                            ? formatDate(u.last_settle_date)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {mult > 0 ? mult : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {risk > 0 ? formatCurrency(risk) : "—"}
                        </TableCell>
                        <TableCell>
                          {u.tradeable_250k ? (
                            <Badge className="bg-green-100 text-green-700 border-transparent dark:bg-green-950 dark:text-green-300">
                              可开仓
                            </Badge>
                          ) : (
                            <Badge
                              variant="destructive"
                              title={`单手风险 ${formatCurrency(risk)} > 7,500 元上限`}
                            >
                              超阈值
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {renderSignalBadge(u)}
                        </TableCell>
                        <TableCell className="pr-4">
                          {u.in_position && u.position_qty !== null ? (
                            <span
                              className={
                                u.position_qty > 0
                                  ? "text-green-600 dark:text-green-400 font-mono font-semibold"
                                  : "text-red-600 dark:text-red-400 font-mono font-semibold"
                              }
                            >
                              {u.position_qty > 0 ? "+" : ""}
                              {u.position_qty} 手
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
