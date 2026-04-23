import { NextResponse, type NextRequest } from "next/server"
import { SESSION_COOKIE } from "@/lib/auth"

/**
 * Edge middleware —— 把未登录请求统一引到 /login。
 *
 * 白名单：
 *   - /login（登录页本身）
 *   - /api/auth/*（登录 / 登出 / 会话检查）
 *   - 静态资源（_next/* / favicon / manifest）
 *   - workspace-api/*（本地后端代理；仅同源调用，无需鉴权）
 *   - api/control/*（控制面 webhook，留给 Agent 系统用）
 *
 * 后端接管后，cookie 名 / 验签策略可在此调整。
 */

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/session",
]

const PUBLIC_PREFIXES = [
  "/_next/",
  "/static/",
  "/workspace-api/",
  "/api/control/",
]

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true
  if (
    pathname === "/favicon.ico" ||
    pathname === "/manifest.webmanifest" ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".ico")
  )
    return true
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl

  if (isPublic(pathname)) return NextResponse.next()

  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (token) return NextResponse.next()

  const url = req.nextUrl.clone()
  url.pathname = "/login"
  url.search = pathname === "/" ? "" : `?redirect=${encodeURIComponent(pathname + search)}`
  return NextResponse.redirect(url)
}

export const config = {
  matcher: [
    /*
     * 匹配所有请求，逻辑里再过滤白名单。
     * 排除常见静态文件后缀以减少中间件触发次数。
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest).*)",
  ],
}
