import { LauncherView } from "./launcher-view.client"

export const dynamic = "force-dynamic"

/**
 * /alpha-lab — 启动台（Launcher）
 *
 * MVP：客户端拉 strategy catalog，用户配置资本 / 策略 / 参数 / sweep 后 Fire。
 * catalog 是相对稳定的元数据（策略模块枚举），所以放 client-side fetch。
 */
export default function AlphaLabPage() {
  return <LauncherView />
}
