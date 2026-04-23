import { ArtifactsView } from "./artifacts-view.client"

export const dynamic = "force-dynamic"

/**
 * /alpha-lab/runs/[runId]/artifacts — 单 run 的候选组合 + 平台验证展示。
 */
export default async function AlphaLabRunArtifactsPage({
  params,
}: {
  params: Promise<{ runId: string }>
}) {
  const { runId } = await params
  return <ArtifactsView runId={runId} />
}
