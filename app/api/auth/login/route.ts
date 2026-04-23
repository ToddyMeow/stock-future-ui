import { NextResponse } from "next/server"
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  isPasswordValid,
  newSessionToken,
} from "@/lib/auth"

export const runtime = "nodejs"

/**
 * POST /api/auth/login —— body { password }
 * 成功：set HttpOnly cookie + 200 { ok: true, operator: { ... } }
 * 失败：401 { error: "invalid_password" }
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { password?: string }
  const pw = String(body.password ?? "")

  if (!isPasswordValid(pw)) {
    return NextResponse.json(
      { error: "invalid_password" },
      { status: 401 },
    )
  }

  const token = newSessionToken()
  const res = NextResponse.json({
    ok: true,
    operator: {
      id: "zh",
      zh: "周行",
      en: "Zhou Heng",
      role: "主操作 · Operator",
    },
    expires_in: SESSION_TTL_SECONDS,
  })
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  })
  return res
}
