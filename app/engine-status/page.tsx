/**
 * app/engine-status/page.tsx — 引擎状态页（RSC 外壳）
 *
 * 首次渲染走一次 server-side fetch（避免白屏），之后交由 client 组件
 * 每 30 秒轮询更新。后端不可达时仍然走 mock 降级（整页红 banner）。
 */
import { fetchEngineStatus, fetchOrMock } from "@/lib/api"
import { MockBanner } from "@/components/mock-banner"
import type { EngineStatus } from "@/lib/types"
import { EngineStatusView } from "./engine-status-view.client"

/** 骨架值 —— 后端挂了时填充前端展示用。 */
function emptyEngineStatus(): EngineStatus {
  return {
    latest_state: null,
    instructions_by_date: [],
    alerts_24h_count: { info: 0, warn: 0, critical: 0 },
    recent_alerts: [],
    db_health: "unreachable",
    launchd_schedule: [],
    server_time: new Date().toISOString(),
    server_timezone: "Asia/Shanghai",
    capital_snapshot: null,
  }
}

export default async function EngineStatusPage() {
  const { data, isMock, error } = await fetchOrMock(
    () => fetchEngineStatus(),
    () => emptyEngineStatus(),
  )
  return (
    <>
      {isMock && <MockBanner reason={error} />}
      <EngineStatusView initial={data} />
    </>
  )
}
