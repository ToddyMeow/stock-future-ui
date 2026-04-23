"use client"

/**
 * app/positions/positions-view.client.tsx — 当前持仓（V1 Morandi 设计）
 *
 * 保留 Q6 换约一键确认（postRollConfirm）+ 分组暴露度图。
 * HBar 自绘 SVG 替换 recharts，保持 Morandi 极简视觉。
 */
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { DirPill } from "@/components/pills"
import { HBar } from "@/components/charts/spark"
import { postRollConfirm } from "@/lib/api"
import { fmtY, signCls, toNum } from "@/lib/format"
import type { DailyPnl, Position, RollCandidate } from "@/lib/types"

type RollDraft = {
  old_close_price: string
  new_open_price: string
  note: string
}

export function PositionsView({
  positions,
  pnl,
  rolls = [],
}: {
  positions: Position[]
  pnl: DailyPnl[]
  rolls?: RollCandidate[]
}) {
  const router = useRouter()

  const rollMap = new Map<string, RollCandidate>()
  for (const r of rolls) rollMap.set(`${r.symbol}|${r.current_contract}`, r)

  const latest = pnl.at(-1)
  const latestEquity = latest?.equity ?? 0

  // ---------- 换约 Dialog ----------
  const [rollTarget, setRollTarget] = useState<{
    candidate: RollCandidate
    position: Position
  } | null>(null)
  const [rollDraft, setRollDraft] = useState<RollDraft>({
    old_close_price: "",
    new_open_price: "",
    note: "",
  })
  const [isRollSubmitting, startRollTransition] = useTransition()

  const openRollDialog = (candidate: RollCandidate, position: Position) => {
    setRollTarget({ candidate, position })
    setRollDraft({
      old_close_price:
        candidate.current_last_price != null ? String(candidate.current_last_price) : "",
      new_open_price:
        candidate.new_last_price != null ? String(candidate.new_last_price) : "",
      note: "",
    })
  }
  const closeRollDialog = () => setRollTarget(null)

  const handleRollSubmit = () => {
    if (!rollTarget) return
    const { candidate } = rollTarget
    const oldPrice = Number(rollDraft.old_close_price)
    const newPrice = Number(rollDraft.new_open_price)
    if (!(oldPrice > 0 && newPrice > 0)) {
      toast.error("请填写有效的旧合约平仓均价和新合约开仓均价")
      return
    }
    startRollTransition(async () => {
      try {
        const resp = await postRollConfirm({
          symbol: candidate.symbol,
          old_contract: candidate.current_contract,
          new_contract: candidate.new_dominant_contract,
          old_close_price: oldPrice,
          new_open_price: newPrice,
          note: rollDraft.note.trim() || undefined,
        })
        toast.success(
          `换约完成 ${resp.old_contract} → ${resp.new_contract} ${Math.abs(resp.qty)} 手`,
          {
            description: `新持仓均价 ${Number(resp.new_open_price).toLocaleString("zh-CN")}`,
          },
        )
        closeRollDialog()
        router.refresh()
      } catch (err) {
        toast.error("换约失败", {
          description: err instanceof Error ? err.message : String(err),
        })
      }
    })
  }

  const notionalOf = (p: Position) => {
    if (p.notional_mv != null) return Number(p.notional_mv)
    const last = Number(p.last_price ?? p.avg_entry_price)
    const mult = Number(p.contract_multiplier ?? 10)
    return Math.abs(p.qty) * last * mult
  }
  const totalNotional = positions.reduce((a, p) => a + notionalOf(p), 0)
  const totalUnrealized = positions.reduce(
    (a, p) => a + Number(p.unrealized_pnl ?? 0),
    0,
  )

  const groupExposure = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of positions) {
      map.set(p.group_name, (map.get(p.group_name) ?? 0) + notionalOf(p))
    }
    return [...map.entries()]
      .map(([group, notional]) => ({ group, notional }))
      .sort((a, b) => b.notional - a.notional)
  }, [positions])

  return (
    <>
      <h1 className="page">当前持仓</h1>
      <div className="sub">实时活跃持仓 · 组级暴露度 · 止损监控</div>

      <div className="kpis" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="kpi">
          <div className="l">账户权益</div>
          <div className="v">{fmtY(latestEquity)}</div>
          <div className="m">
            现金 {fmtY(toNum(latest?.cash) ?? 0)} · 持仓市值{" "}
            {fmtY(toNum(latest?.open_positions_mv) ?? 0)}
          </div>
        </div>
        <div className="kpi">
          <div className="l">合约名义价值</div>
          <div className="v">{fmtY(totalNotional)}</div>
          <div className="m">
            {positions.length} 个合约 · 杠杆{" "}
            {latestEquity > 0 ? (totalNotional / latestEquity).toFixed(2) : "—"}×
          </div>
        </div>
        <div className="kpi">
          <div className="l">浮动盈亏</div>
          <div className={`v ${signCls(totalUnrealized)}`}>
            {fmtY(totalUnrealized, true)}
          </div>
          <div className="m">相对平均开仓价</div>
        </div>
      </div>

      <div className="card-va" style={{ marginTop: 16 }}>
        <div className="hd">
          <div className="ti">持仓明细</div>
          <div className="de">正数为多头 · 负数为空头 · 止损价监控平均入场附近</div>
        </div>
        <div className="bd" style={{ padding: 0 }}>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th style={{ paddingLeft: 16 }}>品种</th>
                  <th>合约</th>
                  <th>方向</th>
                  <th className="ta-r">手数</th>
                  <th className="ta-r">均价</th>
                  <th className="ta-r">最新</th>
                  <th className="ta-r">止损</th>
                  <th>组</th>
                  <th>开仓</th>
                  <th className="ta-r">浮动</th>
                  <th style={{ paddingRight: 16 }}>换约</th>
                </tr>
              </thead>
              <tbody>
                {positions.length === 0 && (
                  <tr>
                    <td
                      colSpan={11}
                      style={{
                        textAlign: "center",
                        color: "var(--graphite-500)",
                        padding: "40px 12px",
                      }}
                    >
                      暂无持仓
                    </td>
                  </tr>
                )}
                {positions.map((p) => {
                  const avgEntry = Number(p.avg_entry_price)
                  const lastPrice = Number(p.last_price ?? avgEntry)
                  const stop = p.stop_loss_price ? Number(p.stop_loss_price) : null
                  const unr = Number(p.unrealized_pnl ?? 0)
                  const roll = rollMap.get(`${p.symbol}|${p.contract_code}`)
                  return (
                    <tr key={`${p.symbol}-${p.contract_code}`}>
                      <td style={{ paddingLeft: 16, fontWeight: 500 }}>{p.symbol}</td>
                      <td
                        className="num"
                        style={{ fontSize: 11, color: "var(--graphite-600)" }}
                      >
                        {p.contract_code}
                      </td>
                      <td>
                        <DirPill dir={p.qty > 0 ? "long" : "short"} />
                      </td>
                      <td
                        className={`ta-r num ${signCls(p.qty)}`}
                        style={{ fontWeight: 600 }}
                      >
                        {p.qty > 0 ? "+" : ""}
                        {p.qty}
                      </td>
                      <td className="ta-r num">
                        {avgEntry.toLocaleString("zh-CN")}
                      </td>
                      <td className="ta-r num">
                        {lastPrice.toLocaleString("zh-CN")}
                      </td>
                      <td className="ta-r num flat">
                        {stop !== null ? stop.toLocaleString("zh-CN") : "—"}
                      </td>
                      <td style={{ fontSize: 11, color: "var(--graphite-500)" }}>
                        {p.group_name}
                      </td>
                      <td style={{ fontSize: 11, color: "var(--graphite-500)" }}>
                        {p.opened_at.slice(5, 10)}
                      </td>
                      <td className={`ta-r num ${signCls(unr)}`}>
                        {fmtY(unr, true)}
                      </td>
                      <td style={{ paddingRight: 16 }}>
                        {roll ? (
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <span className="pill partial">
                              <span className="dot" />→ {roll.new_dominant_contract}
                            </span>
                            <button
                              className="btn"
                              onClick={() => openRollDialog(roll, p)}
                            >
                              换约完成
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: "var(--graphite-500)" }}>
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {groupExposure.length > 0 && (
        <div className="card-va" style={{ marginTop: 16 }}>
          <div className="hd">
            <div className="ti">组级暴露度</div>
            <div className="de">
              按 group_name 聚合的名义价值 — 监控集中度是否触达 portfolio_cap
            </div>
          </div>
          <div className="bd" style={{ height: 180, padding: "0 16px 16px" }}>
            <HBar
              data={groupExposure}
              w={780}
              h={160}
              valueOf={(d) => (d as { notional: number }).notional}
              labelOf={(d) => (d as { group: string }).group}
            />
          </div>
        </div>
      )}

      {rollTarget && (
        <RollDialog
          candidate={rollTarget.candidate}
          position={rollTarget.position}
          draft={rollDraft}
          disabled={isRollSubmitting}
          onDraftChange={(p) => setRollDraft((s) => ({ ...s, ...p }))}
          onCancel={closeRollDialog}
          onConfirm={handleRollSubmit}
        />
      )}
    </>
  )
}

function RollDialog({
  candidate,
  position,
  draft,
  disabled,
  onDraftChange,
  onCancel,
  onConfirm,
}: {
  candidate: RollCandidate
  position: Position
  draft: RollDraft
  disabled: boolean
  onDraftChange: (p: Partial<RollDraft>) => void
  onCancel: () => void
  onConfirm: () => void
}) {
  const input: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    border: "1px solid var(--porcelain-200)",
    borderRadius: 8,
    fontSize: 13,
    fontFamily: "var(--font-mono)",
    background: "var(--card)",
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(21, 23, 27, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={onCancel}
    >
      <div
        className="card-va"
        style={{ width: 520, maxWidth: "100%", padding: "18px 20px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ti" style={{ fontSize: 16, fontWeight: 500 }}>
          换约完成确认
        </div>
        <div className="de" style={{ marginTop: 4 }}>
          平旧开新已在客户端完成后点击确认 · 系统将同步 positions 并写入审计
        </div>
        <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div className="eye" style={{ marginBottom: 4 }}>
                旧合约
              </div>
              <div className="num" style={{ fontSize: 13 }}>
                {candidate.current_contract}
              </div>
            </div>
            <div>
              <div className="eye" style={{ marginBottom: 4 }}>
                新合约
              </div>
              <div className="num" style={{ fontSize: 13 }}>
                {candidate.new_dominant_contract}
              </div>
            </div>
          </div>
          <div>
            <div className="eye" style={{ marginBottom: 4 }}>
              数量
            </div>
            <div className={`num ${signCls(position.qty)}`} style={{ fontSize: 13 }}>
              {position.qty > 0 ? "+" : ""}
              {position.qty} 手（保持方向）
            </div>
          </div>
          <label>
            <div className="eye" style={{ marginBottom: 6 }}>
              旧合约平仓均价
            </div>
            <input
              type="number"
              step="0.01"
              value={draft.old_close_price}
              onChange={(e) => onDraftChange({ old_close_price: e.target.value })}
              disabled={disabled}
              style={input}
            />
          </label>
          <label>
            <div className="eye" style={{ marginBottom: 6 }}>
              新合约开仓均价
            </div>
            <input
              type="number"
              step="0.01"
              value={draft.new_open_price}
              onChange={(e) => onDraftChange({ new_open_price: e.target.value })}
              disabled={disabled}
              style={input}
            />
          </label>
          <label>
            <div className="eye" style={{ marginBottom: 6 }}>
              备注（可选）
            </div>
            <textarea
              placeholder="记录换约细节 / 价差原因等"
              value={draft.note}
              onChange={(e) => onDraftChange({ note: e.target.value })}
              disabled={disabled}
              style={{
                ...input,
                minHeight: 64,
                fontFamily: "var(--font-sans)",
                resize: "vertical",
              }}
            />
          </label>
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            marginTop: 16,
          }}
        >
          <button className="btn" onClick={onCancel} disabled={disabled}>
            取消
          </button>
          <button className="btn prim" onClick={onConfirm} disabled={disabled}>
            {disabled ? "提交中…" : "确认换约"}
          </button>
        </div>
      </div>
    </div>
  )
}
