import type { Metadata, Viewport } from "next"
import "./globals.css"
import { ShellWrapper } from "@/components/shell-wrapper"
import { MobileNav } from "@/components/mobile-nav"
import { Toaster } from "@/components/ui/sonner"

export const metadata: Metadata = {
  title: "Velvet Anchor · 期货交易控制台",
  description: "中国期货半自动实盘交易系统 — 指令回填 / 持仓 / 分析",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Velvet Anchor",
    statusBarStyle: "black-translucent",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F5F7" },
    { media: "(prefers-color-scheme: dark)", color: "#15171B" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="min-h-full">
        <ShellWrapper>{children}</ShellWrapper>
        <MobileNav />
        <Toaster position="top-center" richColors />
      </body>
    </html>
  )
}
