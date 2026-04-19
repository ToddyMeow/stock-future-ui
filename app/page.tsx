/**
 * app/page.tsx — 仪表盘（RSC）
 *
 * 拉三路数据：daily_pnl（90 天）/ instructions（今日）/ alerts（top 3）
 * 任一失败整页降级 mock，顶部红 banner。
 */
import {
  fetchDailyPnl,
  fetchInstructions,
  fetchOrMock,
  fetchRecentAlerts,
} from "@/lib/api"
import {
  mockAlerts,
  mockDailyPnl,
  mockInstructions,
} from "@/lib/mock"
import { MockBanner } from "@/components/mock-banner"
import { DashboardView } from "./dashboard-view.client"

/** 取 ISO YYYY-MM-DD。 */
function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

/** 日期减 N 天。 */
function shiftDate(d: string, days: number): string {
  return new Date(Date.parse(d) + days * 86400_000)
    .toISOString()
    .slice(0, 10)
}

export default async function DashboardPage() {
  const today = todayStr()
  const from = shiftDate(today, -90)

  const [pnlResult, instructionsResult, alertsResult] = await Promise.all([
    fetchOrMock(
      () => fetchDailyPnl(from, today),
      () => mockDailyPnl(90),
    ),
    fetchOrMock(
      () => fetchInstructions(today),
      () => mockInstructions(),
    ),
    fetchOrMock(
      () => fetchRecentAlerts(10),
      () => mockAlerts(),
    ),
  ])

  const isMock =
    pnlResult.isMock || instructionsResult.isMock || alertsResult.isMock
  const mockReason =
    pnlResult.error ?? instructionsResult.error ?? alertsResult.error

  return (
    <>
      {isMock && <MockBanner reason={mockReason} />}
      <DashboardView
        pnlSeries={pnlResult.data}
        instructions={instructionsResult.data}
        alerts={alertsResult.data}
      />
    </>
  )
}
