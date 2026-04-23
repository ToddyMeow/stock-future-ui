"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { AlphaMark, Lockup } from "@/components/brand/brand-mark"

type NavItem = {
  href: string
  label: string
  path: string
}

/**
 * V1 主控制台侧栏 — icon-rail，悬停展开 220px。
 *  - 5 个主页：仪表盘 / 今日指令 / 当前持仓 / 引擎状态 / 分析
 *  - 跨产品入口：Alpha Lab → /alpha-lab
 *  - 底部：版本号 + 环境标识
 *
 * 动画：展开用 CSS transition（width 200ms + shadow）。
 * 点击后 blur() 防止 :focus 保持展开态。
 */
const NAV: NavItem[] = [
  {
    href: "/",
    label: "仪表盘",
    path: "M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z",
  },
  {
    href: "/instructions",
    label: "今日指令",
    path: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2",
  },
  {
    href: "/positions",
    label: "当前持仓",
    path: "M3 3v18h18M7 14l4-4 4 4 5-5",
  },
  {
    href: "/engine-status",
    label: "引擎状态",
    path: "M12 6v6l4 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  },
  {
    href: "/analytics",
    label: "分析",
    path: "M3 3v18h18M7 16V10m5 6V6m5 10v-4",
  },
]

export function Sidebar() {
  const pathname = usePathname() ?? "/"

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/"
    return pathname === href || pathname.startsWith(href + "/")
  }

  return (
    <aside className="side">
      <div className="side-inner">
        <div className="brand">
          <Lockup size={28} />
        </div>
        <nav>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={isActive(item.href) ? "on" : ""}
              onClick={(e) => e.currentTarget.blur()}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                strokeWidth="1.75"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={item.path} />
              </svg>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <Link
          href="/alpha-lab"
          className="xlink"
          onClick={(e) => e.currentTarget.blur()}
        >
          <span className="xmark">
            <AlphaMark size={18} />
          </span>
          <span className="xlabel">Alpha Lab</span>
          <span className="xarr">↗</span>
        </Link>
        <div className="foot">v2.0 · 本地</div>
      </div>
    </aside>
  )
}
