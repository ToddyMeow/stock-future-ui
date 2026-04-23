"use client"

/**
 * app/instructions/instructions-view.client.tsx — 今日指令（V1 Morandi 设计）
 *
 * 保留 P2b 所有真写接口：postFill / vetoInstruction / skipInstruction。
 * 切换 date/session 通过 router.replace 回写 URL，父 RSC 重拉。
 */
import { Fragment, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ActionPill, DirPill, StatusPill } from "@/components/pills"
import { postFill, skipInstruction, vetoInstruction } from "@/lib/api"
import { fmtY, signCls } from "@/lib/format"
import {
  type Instruction,
  type InstructionSession,
  type InstructionStatus,
  type TriggerSource,
  TRIGGER_SOURCE_LABELS,
} from "@/lib/types"

type RowDraft = {
  filled_qty: string
  filled_price: string
  trigger_source: TriggerSource
  note: string
}

const EMPTY_DRAFT: RowDraft = {
  filled_qty: "",
  filled_price: "",
  trigger_source: "user_manual",
  note: "",
}

const FILTERS: Array<[InstructionStatus | "all", string]> = [
  ["all", "全部"],
  ["pending", "待处理"],
  ["partially_filled", "部分"],
  ["fully_filled", "已成交"],
  ["vetoed", "已否决"],
]

export function InstructionsView({
  instructions,
  date,
  session,
}: {
  instructions: Instruction[]
  date: string
  session: InstructionSession
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [submittingId, setSubmittingId] = useState<string | null>(null)

  const [filter, setFilter] = useState<InstructionStatus | "all">("all")
  const [sortBy, setSortBy] = useState<"time" | "symbol">("time")

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({})
  const [vetoTarget, setVetoTarget] = useState<string | null>(null)
  const [vetoReason, setVetoReason] = useState("")
  const [vetoErr, setVetoErr] = useState(false)

  const allRows = instructions
  let rows = filter === "all" ? allRows : allRows.filter((r) => r.status === filter)
  if (sortBy === "symbol") rows = [...rows].sort((a, b) => a.symbol.localeCompare(b.symbol))

  const pendingCount = allRows.filter(
    (r) => r.status === "pending" || r.status === "partially_filled",
  ).length

  const getDraft = (id: string): RowDraft => drafts[id] ?? EMPTY_DRAFT
  const setDraft = (id: string, patch: Partial<RowDraft>) =>
    setDrafts((s) => ({ ...s, [id]: { ...getDraft(id), ...patch } }))

  const updateUrl = (next: { date?: string; session?: string }) => {
    const q = new URLSearchParams({
      date: next.date ?? date,
      session: next.session ?? session,
    })
    router.replace(`/instructions?${q.toString()}`)
  }

  // ---------- Fill 回填 ----------
  const handleRowSubmit = (id: string) => {
    const d = getDraft(id)
    const qty = Number(d.filled_qty)
    const price = Number(d.filled_price)
    if (!(qty > 0 && price > 0)) {
      toast.error("请填写有效的成交量和成交价")
      return
    }
    setSubmittingId(id)
    startTransition(async () => {
      try {
        await postFill({
          instruction_id: id,
          filled_qty: qty,
          filled_price: price,
          filled_at: new Date().toISOString(),
          trigger_source: d.trigger_source,
          note: d.note.trim() || null,
        })
        toast.success(`已回填：${qty} 手 @ ${price}`, {
          description: `触发源：${TRIGGER_SOURCE_LABELS[d.trigger_source]}`,
        })
        setExpandedId(null)
        setDrafts((s) => {
          const n = { ...s }
          delete n[id]
          return n
        })
        router.refresh()
      } catch (err) {
        toast.error("回填失败", {
          description: err instanceof Error ? err.message : String(err),
        })
      } finally {
        setSubmittingId(null)
      }
    })
  }

  const handleSkip = (id: string) => {
    setSubmittingId(id)
    startTransition(async () => {
      try {
        await skipInstruction(id)
        toast.message("已标记跳过", { description: `指令 ${id.slice(0, 14)}… 不再追踪` })
        setExpandedId(null)
        router.refresh()
      } catch (err) {
        toast.error("跳过失败", {
          description: err instanceof Error ? err.message : String(err),
        })
      } finally {
        setSubmittingId(null)
      }
    })
  }

  const handleVetoSubmit = () => {
    if (!vetoReason.trim()) {
      setVetoErr(true)
      return
    }
    const id = vetoTarget
    if (!id) return
    setSubmittingId(id)
    startTransition(async () => {
      try {
        await vetoInstruction(id, vetoReason.trim())
        toast.error(`已否决：${vetoReason.slice(0, 30)}`, { description: "原因已写入审计日志" })
        setVetoTarget(null)
        setVetoReason("")
        setVetoErr(false)
        setExpandedId(null)
        router.refresh()
      } catch (err) {
        toast.error("否决失败", {
          description: err instanceof Error ? err.message : String(err),
        })
      } finally {
        setSubmittingId(null)
      }
    })
  }

  return (
    <>
      <h1 className="page">今日指令</h1>
      <div className="sub">回填实际成交 · 否决 · 跳过 — 每条指令必须闭环</div>

      <div className="card-va" style={{ marginTop: 16 }}>
        <div
          className="hd"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div className="ti">
              {session === "day" ? "日盘" : "夜盘"} · {date}
            </div>
            <div className="de">
              共 {allRows.length} 条 · 匹配 {rows.length} 条 · 待处理 {pendingCount}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <input
              type="date"
              value={date}
              onChange={(e) => updateUrl({ date: e.target.value })}
              className="btn"
              style={{
                padding: "5px 10px",
                fontSize: 12,
                fontFamily: "var(--font-mono)",
              }}
            />
            <div className="seg">
              <button
                className={session === "day" ? "on" : ""}
                onClick={() => updateUrl({ session: "day" })}
              >
                日盘
              </button>
              <button
                className={session === "night" ? "on" : ""}
                onClick={() => updateUrl({ session: "night" })}
              >
                夜盘
              </button>
            </div>
            <span
              style={{
                width: 1,
                height: 18,
                background: "var(--porcelain-200)",
                margin: "0 2px",
              }}
            />
            {FILTERS.map(([k, l]) => (
              <button
                key={k}
                className={`btn ${filter === k ? "prim" : ""}`}
                onClick={() => setFilter(k)}
              >
                {l}
              </button>
            ))}
            <span
              style={{
                width: 1,
                height: 18,
                background: "var(--porcelain-200)",
                margin: "0 2px",
              }}
            />
            <button
              className="btn"
              onClick={() => setSortBy((s) => (s === "time" ? "symbol" : "time"))}
            >
              排序：{sortBy === "time" ? "时间" : "品种"}
            </button>
          </div>
        </div>
        <div className="bd" style={{ padding: 0 }}>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th style={{ paddingLeft: 16 }}>品种</th>
                  <th>合约</th>
                  <th>动作</th>
                  <th>方向</th>
                  <th className="ta-r">目标</th>
                  <th className="ta-r">参考入场</th>
                  <th className="ta-r">止损</th>
                  <th className="ta-r">已成交</th>
                  <th>状态</th>
                  <th className="ta-r" style={{ paddingRight: 16 }}>
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      style={{
                        textAlign: "center",
                        color: "var(--graphite-500)",
                        padding: "40px 12px",
                      }}
                    >
                      该日期 / 时段没有指令
                    </td>
                  </tr>
                )}
                {rows.map((r) => {
                  const locked = ["fully_filled", "vetoed", "skipped", "expired"].includes(
                    r.status,
                  )
                  const exp = expandedId === r.id
                  const rem = r.target_qty - (r.filled_qty_total ?? 0)
                  const rowSubmitting = submittingId === r.id && isPending
                  return (
                    <Fragment key={r.id}>
                      <tr>
                        <td style={{ fontWeight: 500, paddingLeft: 16 }}>{r.symbol}</td>
                        <td
                          className="num"
                          style={{ fontSize: 11, color: "var(--graphite-600)" }}
                        >
                          {r.contract_code}
                        </td>
                        <td>
                          <ActionPill action={r.action} />
                        </td>
                        <td>
                          <DirPill dir={r.direction} />
                        </td>
                        <td className="ta-r num">{r.target_qty}</td>
                        <td className="ta-r num flat">{r.entry_price_ref ?? "—"}</td>
                        <td className="ta-r num flat">{r.stop_loss_ref ?? "—"}</td>
                        <td className="ta-r num">
                          {r.filled_qty_total ?? 0}/{r.target_qty}
                        </td>
                        <td>
                          <StatusPill status={r.status} />
                        </td>
                        <td className="ta-r" style={{ paddingRight: 16 }}>
                          {locked ? (
                            <span style={{ fontSize: 11, color: "var(--graphite-500)" }}>
                              已结束
                            </span>
                          ) : (
                            <button
                              className="btn"
                              onClick={() => {
                                setExpandedId(exp ? null : r.id)
                              }}
                            >
                              {exp ? "收起" : "展开"}
                            </button>
                          )}
                        </td>
                      </tr>
                      {exp && !locked && (
                        <tr>
                          <td
                            colSpan={10}
                            style={{ background: "var(--porcelain-50)", padding: 16 }}
                          >
                            <InlineFillForm
                              draft={getDraft(r.id)}
                              maxQty={rem}
                              refPrice={r.entry_price_ref ?? null}
                              disabled={rowSubmitting}
                              onChange={(p) => setDraft(r.id, p)}
                              onSubmit={() => handleRowSubmit(r.id)}
                              onVeto={() => {
                                setVetoTarget(r.id)
                                setVetoReason("")
                                setVetoErr(false)
                              }}
                              onSkip={() => handleSkip(r.id)}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 否决 Dialog — hairline modal */}
      {vetoTarget !== null && (
        <VetoDialog
          reason={vetoReason}
          hasError={vetoErr}
          disabled={isPending}
          onReasonChange={(v) => {
            setVetoReason(v)
            if (v.trim()) setVetoErr(false)
          }}
          onCancel={() => {
            setVetoTarget(null)
            setVetoReason("")
            setVetoErr(false)
          }}
          onConfirm={handleVetoSubmit}
        />
      )}
    </>
  )
}

/** 行内回填表单（展开行）。 */
function InlineFillForm({
  draft,
  maxQty,
  refPrice,
  disabled,
  onChange,
  onSubmit,
  onVeto,
  onSkip,
}: {
  draft: RowDraft
  maxQty: number
  refPrice: number | null
  disabled: boolean
  onChange: (p: Partial<RowDraft>) => void
  onSubmit: () => void
  onVeto: () => void
  onSkip: () => void
}) {
  const qty = Number(draft.filled_qty)
  const price = Number(draft.filled_price)
  const filledEst = qty * price
  const refCost = refPrice ? qty * refPrice : 0
  const slip = refCost > 0 ? filledEst - refCost : 0
  const showSlip = refPrice && qty > 0 && price > 0

  const inputStyle: React.CSSProperties = {
    padding: "8px 10px",
    border: "1px solid var(--porcelain-200)",
    borderRadius: 8,
    width: "100%",
    fontSize: 13,
    background: "var(--card)",
    fontFamily: "var(--font-mono)",
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr auto",
        gap: 12,
        alignItems: "end",
      }}
    >
      <label>
        <div className="eye" style={{ marginBottom: 6 }}>
          成交量（手）
        </div>
        <input
          type="number"
          min={1}
          max={maxQty}
          placeholder={`剩余 ${maxQty}`}
          value={draft.filled_qty}
          onChange={(e) => onChange({ filled_qty: e.target.value })}
          disabled={disabled}
          style={inputStyle}
        />
      </label>
      <label>
        <div className="eye" style={{ marginBottom: 6 }}>
          成交价
        </div>
        <input
          type="number"
          step="0.01"
          placeholder={refPrice ? String(refPrice) : "价格"}
          value={draft.filled_price}
          onChange={(e) => onChange({ filled_price: e.target.value })}
          disabled={disabled}
          style={inputStyle}
        />
      </label>
      <label>
        <div className="eye" style={{ marginBottom: 6 }}>
          触发源
        </div>
        <select
          value={draft.trigger_source}
          onChange={(e) => onChange({ trigger_source: e.target.value as TriggerSource })}
          disabled={disabled}
          style={inputStyle}
        >
          {(Object.entries(TRIGGER_SOURCE_LABELS) as [TriggerSource, string][]).map(
            ([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ),
          )}
        </select>
      </label>
      <div style={{ display: "flex", gap: 6 }}>
        <button className="btn prim" onClick={onSubmit} disabled={disabled}>
          {disabled ? "提交中…" : "成交回填"}
        </button>
        <button className="btn dan" onClick={onVeto} disabled={disabled}>
          否决
        </button>
        <button className="btn" onClick={onSkip} disabled={disabled}>
          跳过
        </button>
      </div>
      <label style={{ gridColumn: "1 / -1" }}>
        <div className="eye" style={{ marginBottom: 6 }}>
          备注（可选）
        </div>
        <textarea
          placeholder="记录成交细节 / 盘中观察，可选"
          value={draft.note}
          onChange={(e) => onChange({ note: e.target.value })}
          disabled={disabled}
          style={{
            ...inputStyle,
            minHeight: 64,
            resize: "vertical",
            fontFamily: "var(--font-sans)",
          }}
        />
      </label>
      {showSlip && (
        <div
          style={{
            gridColumn: "1 / -1",
            display: "flex",
            gap: 24,
            fontSize: 11,
            color: "var(--graphite-500)",
            paddingTop: 8,
            borderTop: "1px solid var(--porcelain-200)",
          }}
        >
          <span>
            估算成交：
            <span
              className="num"
              style={{ marginLeft: 4, color: "var(--graphite-900)" }}
            >
              {fmtY(filledEst)}
            </span>
          </span>
          <span>
            相对参考滑点：
            <span className={`num ${signCls(slip)}`} style={{ marginLeft: 4 }}>
              {slip > 0 ? "+" : ""}
              {Math.round(slip).toLocaleString("zh-CN")}
            </span>
          </span>
        </div>
      )}
    </div>
  )
}

/** 否决 Dialog —— 朴素 modal，Morandi 调。 */
function VetoDialog({
  reason,
  hasError,
  disabled,
  onReasonChange,
  onCancel,
  onConfirm,
}: {
  reason: string
  hasError: boolean
  disabled: boolean
  onReasonChange: (v: string) => void
  onCancel: () => void
  onConfirm: () => void
}) {
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
        style={{ width: 480, maxWidth: "100%", padding: "18px 20px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ti" style={{ fontSize: 16, fontWeight: 500 }}>
          否决指令
        </div>
        <div className="de" style={{ marginTop: 4 }}>
          否决原因将写入 audit log · 审计不可变，请填写清楚
        </div>
        <label style={{ display: "block", marginTop: 14 }}>
          <div className="eye" style={{ marginBottom: 6 }}>
            否决原因
          </div>
          <textarea
            placeholder="示例：盘前公告突发，价格跳空，暂不建仓"
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            autoFocus
            style={{
              width: "100%",
              minHeight: 96,
              padding: "10px 12px",
              border: `1px solid ${hasError ? "var(--pnl-neg)" : "var(--porcelain-200)"}`,
              borderRadius: 8,
              fontSize: 13,
              background: "var(--card)",
              fontFamily: "var(--font-sans)",
              resize: "vertical",
            }}
          />
          {hasError && (
            <p style={{ fontSize: 11, color: "var(--pnl-neg)", marginTop: 4 }}>
              否决原因不能为空
            </p>
          )}
        </label>
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
          <button className="btn dan" onClick={onConfirm} disabled={disabled}>
            确认否决
          </button>
        </div>
      </div>
    </div>
  )
}
