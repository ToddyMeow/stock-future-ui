"use client"

/**
 * MobileNav — Morandi 风格底部 tab bar（手机端 < md）。
 *
 * 设计：
 *   - hairline 卡片，悬浮在底部，安全区适配
 *   - 4 个主页 + 「更多」抽屉里二级页
 *   - 路径白名单：仅在主控制台 / Alpha Lab 路由展示；登录页隐藏
 *   - Alpha Lab 子路径下切到 4 个 Alpha 页面（启动台/列表/Phase/工件）
 */
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { cn } from "@/lib/utils"

type Item = {
  href: string
  label: string
  /** 12×12 viewbox SVG path */
  d: string
  match: (p: string) => boolean
}

const CONSOLE_PRIMARY: Item[] = [
  {
    href: "/",
    label: "仪表盘",
    d: "M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z",
    match: (p) => p === "/",
  },
  {
    href: "/instructions",
    label: "指令",
    d: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2",
    match: (p) => p.startsWith("/instructions"),
  },
  {
    href: "/positions",
    label: "持仓",
    d: "M3 3v18h18M7 14l4-4 4 4 5-5",
    match: (p) => p.startsWith("/positions"),
  },
  {
    href: "/analytics",
    label: "分析",
    d: "M3 3v18h18M7 16V10m5 6V6m5 10v-4",
    match: (p) => p.startsWith("/analytics"),
  },
]

const CONSOLE_SECONDARY: Item[] = [
  {
    href: "/engine-status",
    label: "引擎状态",
    d: "M12 6v6l4 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
    match: (p) => p.startsWith("/engine-status"),
  },
  {
    href: "/formulas",
    label: "风险与公式",
    d: "M5 3h14M5 21h14M9 3v18M15 3v18M5 9h14M5 15h14",
    match: (p) => p.startsWith("/formulas"),
  },
  {
    href: "/universe",
    label: "盯盘品种",
    d: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
    match: (p) => p.startsWith("/universe"),
  },
  {
    href: "/history",
    label: "历史查询",
    d: "M3 12a9 9 0 1 0 9-9 9 9 0 0 0-7 3.4M3 4v4h4M12 7v5l3 2",
    match: (p) => p.startsWith("/history"),
  },
  {
    href: "/reports/today",
    label: "每日报告",
    d: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 13h6M9 17h4",
    match: (p) => p.startsWith("/reports"),
  },
  {
    href: "/alpha-lab",
    label: "Alpha 实验室",
    d: "M9 3v6l-5 8c-1 2 0 4 2 4h12c2 0 3-2 2-4l-5-8V3M9 3h6",
    match: (p) => p.startsWith("/alpha-lab"),
  },
]

const ALPHA_PRIMARY: Item[] = [
  {
    href: "/alpha-lab",
    label: "启动台",
    d: "M12 4v10M8 8l4-4 4 4M5 20h14",
    match: (p) => p === "/alpha-lab",
  },
  {
    href: "/alpha-lab/runs",
    label: "运行",
    d: "M4 6h16M4 12h16M4 18h10",
    match: (p) =>
      p === "/alpha-lab/runs" ||
      (p.startsWith("/alpha-lab/runs/") && !p.endsWith("/artifacts")),
  },
  {
    href: "/alpha-lab/phase",
    label: "Phase",
    d: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
    match: (p) => p.startsWith("/alpha-lab/phase") || p.endsWith("/phase"),
  },
  {
    href: "/alpha-lab/artifacts",
    label: "工件",
    d: "M12 3l8 4-8 4-8-4 8-4zM4 7v10l8 4 8-4V7M12 11v10",
    match: (p) =>
      p === "/alpha-lab/artifacts" || p.endsWith("/artifacts"),
  },
]

const ALPHA_SECONDARY: Item[] = [
  {
    href: "/",
    label: "返回控制台",
    d: "M19 12H5M12 19l-7-7 7-7",
    match: () => false,
  },
]

function NavIcon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  )
}

export function MobileNav() {
  const pathname = usePathname() ?? "/"
  const [drawerOpen, setDrawerOpen] = useState(false)

  // 路径白名单：登录、锁屏整页接管，不挂底部 nav
  if (pathname === "/login" || pathname.startsWith("/login/")) return null

  const isAlpha = pathname.startsWith("/alpha-lab")
  const PRIMARY = isAlpha ? ALPHA_PRIMARY : CONSOLE_PRIMARY
  const SECONDARY = isAlpha ? ALPHA_SECONDARY : CONSOLE_SECONDARY

  const moreActive = SECONDARY.some((i) => i.match(pathname))

  const closeDrawer = () => setDrawerOpen(false)

  return (
    <>
      {/* 底部 tab bar — Morandi 卡片 hairline */}
      <nav
        className={cn(
          "md:hidden fixed bottom-0 inset-x-0 z-40",
          "px-2.5 pb-[max(8px,env(safe-area-inset-bottom))] pt-2",
        )}
      >
        <div
          className="grid grid-cols-5 rounded-2xl"
          style={{
            background: "var(--card)",
            border: "1px solid var(--porcelain-200)",
            boxShadow: "var(--shadow-float)",
            backdropFilter: "blur(8px)",
          }}
        >
          {PRIMARY.map((item) => {
            const active = item.match(pathname)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] transition-colors min-h-[56px]",
                )}
                style={{
                  color: active
                    ? "var(--graphite-900)"
                    : "var(--graphite-500)",
                  fontWeight: active ? 500 : 400,
                }}
              >
                <NavIcon d={item.d} />
                <span>{item.label}</span>
              </Link>
            )
          })}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] min-h-[56px] cursor-pointer"
            style={{
              color: moreActive
                ? "var(--graphite-900)"
                : "var(--graphite-500)",
              background: "transparent",
              border: "none",
              fontWeight: moreActive ? 500 : 400,
            }}
          >
            <NavIcon d="M5 12h14M5 6h14M5 18h14" />
            <span>更多</span>
          </button>
        </div>
      </nav>

      {/* 抽屉 */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-50"
          style={{ background: "rgba(21, 23, 27, 0.45)" }}
          onClick={closeDrawer}
        >
          <div
            className="absolute bottom-0 inset-x-0 rounded-t-2xl pb-[max(16px,env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom duration-200"
            style={{ background: "var(--card)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: 36,
                height: 3,
                background: "var(--porcelain-300)",
                borderRadius: 2,
                margin: "10px auto 14px",
              }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0 18px 6px",
              }}
            >
              <h3 style={{ fontSize: 14, fontWeight: 500 }}>更多</h3>
              <button
                type="button"
                onClick={closeDrawer}
                aria-label="关闭"
                style={{
                  fontSize: 18,
                  color: "var(--graphite-500)",
                  background: "transparent",
                  border: "none",
                  padding: 6,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>
            <ul style={{ padding: "4px 10px 12px", margin: 0, listStyle: "none" }}>
              {SECONDARY.map((item) => {
                const active = item.match(pathname)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={closeDrawer}
                      className="flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] min-h-[48px] active:opacity-80"
                      style={{
                        background: active
                          ? "var(--porcelain-100)"
                          : "transparent",
                        color: "var(--graphite-900)",
                        fontWeight: active ? 500 : 400,
                      }}
                    >
                      <span style={{ color: "var(--graphite-500)" }}>
                        <NavIcon d={item.d} />
                      </span>
                      <span>{item.label}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  )
}
