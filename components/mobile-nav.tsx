"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  Home,
  Wallet,
  ListChecks,
  BarChart3,
  Menu,
  X,
  Activity,
  Calculator,
  Eye,
  History,
  FileText,
} from "lucide-react"
import { cn } from "@/lib/utils"

const PRIMARY = [
  { href: "/", label: "仪表盘", icon: Home, match: (p: string) => p === "/" },
  { href: "/positions", label: "持仓", icon: Wallet, match: (p: string) => p.startsWith("/positions") },
  { href: "/instructions", label: "指令", icon: ListChecks, match: (p: string) => p.startsWith("/instructions") },
  { href: "/analytics", label: "分析", icon: BarChart3, match: (p: string) => p.startsWith("/analytics") },
] as const

const SECONDARY = [
  { href: "/engine-status", label: "引擎状态", icon: Activity },
  { href: "/formulas", label: "风险与公式", icon: Calculator },
  { href: "/universe", label: "盯盘品种", icon: Eye },
  { href: "/history", label: "历史查询", icon: History },
  { href: "/reports/today", label: "每日报告", icon: FileText },
] as const

export function MobileNav() {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const moreActive = SECONDARY.some((i) =>
    i.href === "/reports/today"
      ? pathname.startsWith("/reports")
      : pathname.startsWith(i.href),
  )

  return (
    <>
      {/* 底部 tab bar — 仅手机显示 */}
      <nav
        className={cn(
          "md:hidden fixed bottom-0 inset-x-0 z-40",
          "bg-background/95 backdrop-blur border-t border-border",
          "pb-[env(safe-area-inset-bottom)]",
        )}
      >
        <ul className="grid grid-cols-5">
          {PRIMARY.map((item) => {
            const Icon = item.icon
            const active = item.match(pathname)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] transition-colors",
                    "min-h-[56px]",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground active:text-foreground",
                  )}
                >
                  <Icon className={cn("h-5 w-5", active && "fill-current/10")} />
                  <span className={cn(active && "font-medium")}>{item.label}</span>
                </Link>
              </li>
            )
          })}
          <li>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] transition-colors w-full",
                "min-h-[56px]",
                moreActive
                  ? "text-foreground"
                  : "text-muted-foreground active:text-foreground",
              )}
            >
              <Menu className="h-5 w-5" />
              <span className={cn(moreActive && "font-medium")}>更多</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* 底部抽屉 — 点击 "更多" 打开 */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/50"
          onClick={() => setDrawerOpen(false)}
        >
          <div
            className={cn(
              "absolute bottom-0 inset-x-0",
              "bg-background rounded-t-2xl",
              "pb-[env(safe-area-inset-bottom)]",
              "shadow-2xl animate-in slide-in-from-bottom duration-200",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h3 className="text-base font-semibold">更多</h3>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-2 -m-2 rounded-full text-muted-foreground active:bg-accent"
                aria-label="关闭"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className="p-2 pb-4">
              {SECONDARY.map((item) => {
                const Icon = item.icon
                const active =
                  item.href === "/reports/today"
                    ? pathname.startsWith("/reports")
                    : pathname.startsWith(item.href)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setDrawerOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors",
                        "min-h-[52px]",
                        active
                          ? "bg-accent text-accent-foreground font-medium"
                          : "text-foreground active:bg-accent/60",
                      )}
                    >
                      <Icon className="h-5 w-5 text-muted-foreground" />
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
