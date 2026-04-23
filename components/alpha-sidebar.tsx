"use client"

/**
 * Alpha Lab 侧栏（.exp1-side）— 与主控制台侧栏视觉区隔。
 *  - 4 个页面：启动台 / 运行列表 / 分阶段上线 / 实验工件
 *  - 底部回到主控制台的 xlink
 *  - 品牌 AlphaLockup + `v0 · live` 状态 pill
 */
import Link from "next/link"
import { usePathname } from "next/navigation"
import { AlphaLockup } from "@/components/brand/brand-mark"

type NavItem = {
  href: string
  label: string
  path: string
  match: (pathname: string) => boolean
}

const NAV: NavItem[] = [
  {
    href: "/alpha-lab",
    label: "启动台",
    path: "M12 4v10M8 8l4-4 4 4M5 20h14",
    match: (p) => p === "/alpha-lab",
  },
  {
    href: "/alpha-lab/runs",
    label: "运行列表",
    path: "M4 6h16M4 12h16M4 18h10",
    match: (p) =>
      p === "/alpha-lab/runs" ||
      (p.startsWith("/alpha-lab/runs/") && !p.endsWith("/artifacts")),
  },
  {
    href: "/alpha-lab/phase",
    label: "分阶段上线",
    path: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
    match: (p) => p.startsWith("/alpha-lab/phase") || p.endsWith("/phase"),
  },
  {
    href: "/alpha-lab/artifacts",
    label: "工件",
    path: "M12 3l8 4-8 4-8-4 8-4zM4 7v10l8 4 8-4V7M12 11v10",
    match: (p) =>
      p === "/alpha-lab/artifacts" || p.endsWith("/artifacts"),
  },
]

export function AlphaSidebar() {
  const pathname = usePathname() ?? "/alpha-lab"
  return (
    <aside className="exp1-side">
      <div className="brand-row">
        <AlphaLockup size={22} />
        <span className="pill filled">
          <span className="dot" />v0 · live
        </span>
      </div>
      <nav>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={item.match(pathname) ? "on" : ""}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={item.path} />
            </svg>
            {item.label}
          </Link>
        ))}
      </nav>
      <Link href="/" className="xlink">
        ← 返回控制台
        <span className="xarr">↩</span>
      </Link>
      <div className="foot">ALPHA LAB · v0</div>
    </aside>
  )
}
