import { RunsView } from "./runs-view.client"

export const dynamic = "force-dynamic"

/**
 * /alpha-lab/runs — 运行列表 + sweep 状态聚合。
 *
 * 列表 client-side 拉（轮询 5 秒）；sweep 状态以 run_id 前缀聚合近 24h。
 */
export default function AlphaLabRunsPage() {
  return <RunsView />
}
