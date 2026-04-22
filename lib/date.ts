/**
 * lib/date.ts — 日期工具
 *
 * 2026-04-20 修复：原先多处用 `new Date().toISOString().slice(0, 10)` 获取
 * "今日 YYYY-MM-DD"，但 toISOString() 走 UTC；北京时间 00:00-08:00 之间会
 * 落到 UTC 前一天，导致前端显示的日期比实际交易日早 1 天。
 *
 * 统一从这里导出，所有页面 import todayStr() 用本地时区（Next.js server
 * 进程继承 shell TZ=Asia/Shanghai）。
 */

export function todayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${dd}`
}

export function shiftDate(d: string, days: number): string {
  // 在 "YYYY-MM-DD" 上加减天数，返回同样格式字符串（本地时区）
  const [y, m, dd] = d.split("-").map((x) => parseInt(x, 10))
  const base = new Date(y, m - 1, dd)
  base.setDate(base.getDate() + days)
  const ny = base.getFullYear()
  const nm = String(base.getMonth() + 1).padStart(2, "0")
  const ndd = String(base.getDate()).padStart(2, "0")
  return `${ny}-${nm}-${ndd}`
}
