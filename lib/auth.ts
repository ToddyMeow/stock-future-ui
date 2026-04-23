/**
 * lib/auth.ts — 单人密码登录的轻量本地实现。
 *
 * 设计选择（由前端提供 stub，最终由后端接管 — 见 docs/BACKEND_REQUIREMENTS.md §11）：
 *   - 单一 operator（"周行 / Zhou Heng"），密码取 env `OPERATOR_PASSWORD`
 *     未设置时默认 `velvet-anchor`（仅本地 dev）
 *   - 登录成功 → 写 HttpOnly cookie `va_session=<24h-token>`
 *   - 中间件保护：除 /login、/api/auth/* 之外的页面，缺 cookie 则跳 /login
 *
 * 后端接管步骤：
 *   1. 后端实现 POST /api/auth/login → set 自己的 cookie
 *   2. 前端 lib/api.ts 改成调真接口
 *   3. middleware.ts 改成读后端约定的 cookie 名 + JWT 验签
 */

export const SESSION_COOKIE = "va_session"
export const SESSION_TTL_SECONDS = 60 * 60 * 24 // 24h

const FALLBACK_PASSWORD = "velvet-anchor" // 仅 dev — 上线必须设环境变量

/** 检查输入密码是否正确。`process.env` 仅服务器侧可读。 */
export function isPasswordValid(input: string): boolean {
  const expected = process.env.OPERATOR_PASSWORD || FALLBACK_PASSWORD
  if (!input || typeof input !== "string") return false
  // 时间常数比较（避免 timing attack —— 简化版）
  if (input.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < input.length; i++) {
    diff |= input.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0
}

/** 生成新的会话 token（仅 stub —— 后端接管后改 JWT/服务端签名）。 */
export function newSessionToken(): string {
  // 32 字节随机 hex
  const bytes = new Uint8Array(32)
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}
