import { PhaseTrackerView } from "./phase-tracker-view.client"

export const dynamic = "force-dynamic"

/**
 * /alpha-lab/runs/[runId] — 单个 run 的分阶段上线跟踪。
 *
 * 展示两列（25k / 100k）对齐 capital_progress，每列 Phase 0–5 + 平台验证。
 */
export default async function AlphaLabPhasePage({
  params,
}: {
  params: Promise<{ runId: string }>
}) {
  const { runId } = await params
  return <PhaseTrackerView runId={runId} />
}
