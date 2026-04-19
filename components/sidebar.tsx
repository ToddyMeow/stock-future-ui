"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/", label: "仪表盘" },
  { href: "/instructions", label: "今日指令" },
  { href: "/positions", label: "当前持仓" },
  { href: "/history", label: "历史查询" },
  { href: "/analytics", label: "分析" },
  { href: "/reports/today", label: "每日报告" },
] as const

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-60 border-r border-border bg-background p-4 shrink-0">
      <div className="mb-6 px-2">
        <h2 className="text-lg font-semibold tracking-tight">期货实盘</h2>
        <p className="text-xs text-muted-foreground mt-1">半自动交易控制台</p>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href ||
                pathname.startsWith(item.href + "/") ||
                // special-case /reports/[date]
                (item.href === "/reports/today" && pathname.startsWith("/reports"))

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
