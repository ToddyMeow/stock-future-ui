import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE } from "@/lib/auth"

export const runtime = "nodejs"

/** GET /api/auth/session —— 检查会话有效性。 */
export async function GET() {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 200 })
  }
  return NextResponse.json({
    authenticated: true,
    operator: {
      id: "zh",
      zh: "周行",
      en: "Zhou Heng",
      role: "主操作 · Operator",
    },
  })
}
