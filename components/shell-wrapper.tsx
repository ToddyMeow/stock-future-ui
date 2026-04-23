"use client"

/**
 * ShellWrapper — 根据路径动态切换「主控制台壳」与「Alpha Lab 壳」。
 *
 * 放在根 layout 里作为 children 的容器；自身是 client component
 * （需要 usePathname），但接受 RSC children 传入，数据层仍走服务器组件。
 */
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { Sidebar } from "@/components/sidebar"
import { AlphaSidebar } from "@/components/alpha-sidebar"

export function ShellWrapper({ children }: { children: ReactNode }) {
  const path = usePathname() ?? "/"
  const isAlpha = path.startsWith("/alpha-lab")
  const isAuth = path === "/login" || path.startsWith("/login/")

  // 登录 / 锁屏：不挂任何壳，整页留给 login UI 自行支配
  if (isAuth) {
    return <>{children}</>
  }

  if (isAlpha) {
    return (
      <div className="exp1">
        <div className="hidden md:block">
          <AlphaSidebar />
        </div>
        <main className="exp1-main pb-24 md:pb-0">{children}</main>
      </div>
    )
  }

  return (
    <div className="v1">
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <main className="main pb-24 md:pb-0">{children}</main>
    </div>
  )
}
