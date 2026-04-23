/**
 * lib/format.ts — Morandi 设计系统共用格式化工具。
 *
 * 与 lib/mock.ts 的 formatCurrency 并存（后者保留兼容）；新页面统一使用本文件。
 */

/** 把金额格式化为 `¥1,234,567` / `+¥1,234` / `-¥567`。 */
export function fmtY(n: number | null | undefined, withSign = false): string {
  if (n == null || !Number.isFinite(n)) return "—"
  const abs = Math.abs(Math.round(n)).toLocaleString("zh-CN")
  if (n < 0) return `-¥${abs}`
  return `${withSign ? "+" : ""}¥${abs}`
}

/** 把小数格式化为百分比字符串 `12.34%`，保留 n 位小数。 */
export function fmtPct(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—"
  return `${(n * 100).toFixed(digits)}%`
}

/** 根据正负返回 Morandi 语义类名（`pos` / `neg` / `flat`）。 */
export function signCls(n: number | null | undefined): "pos" | "neg" | "flat" {
  if (n == null || !Number.isFinite(n) || n === 0) return "flat"
  return n > 0 ? "pos" : "neg"
}

/** `Number | string | null` → `number | null`（后端 Decimal 常序列化为字符串）。 */
export function toNum(v: number | string | null | undefined): number | null {
  if (v == null) return null
  if (typeof v === "number") return Number.isFinite(v) ? v : null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** ISO 日期串 → `MM-DD`。 */
export function shortDate(iso: string): string {
  return iso.slice(5, 10)
}

/** ISO 时间戳 → `HH:MM`（按本机时区）。 */
export function shortTime(iso: string): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(11, 16) // fallback 截串
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}
