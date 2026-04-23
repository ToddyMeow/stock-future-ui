import { PhaseLandingView } from "./phase-landing-view.client"

export const dynamic = "force-dynamic"

/**
 * /alpha-lab/phase — 分阶段上线落地页。
 *
 * 未选 run 时的「选择器」；有 running 的 run 则自动跳转到它的 phase detail。
 */
export default function AlphaLabPhaseLandingPage() {
  return <PhaseLandingView />
}
