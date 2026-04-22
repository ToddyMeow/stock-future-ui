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
  fetchRolls,
} from "@/lib/api"
import {
  mockAlerts,
  mockDailyPnl,
  mockInstructions,
  mockRolls,
} from "@/lib/mock"
import { MockBanner } from "@/components/mock-banner"
import { DashboardView } from "./dashboard-view.client"
import { todayStr, shiftDate } from "@/lib/date"

/** 取 ISO YYYY-MM-DD。 */
/** 日期减 N 天。 */
export default async function DashboardPage() {
  const today = todayStr()
  const from = shiftDate(today, -90)

  const [pnlResult, instructionsResult, alertsResult, rollsResult] =
    await Promise.all([
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
      fetchOrMock(
        () => fetchRolls(),
        () => mockRolls(),
      ),
    ])

  const isMock =
    pnlResult.isMock ||
    instructionsResult.isMock ||
    alertsResult.isMock ||
    rollsResult.isMock
  const mockReason =
    pnlResult.error ??
    instructionsResult.error ??
    alertsResult.error ??
    rollsResult.error

  return (
    <>
      {isMock && <MockBanner reason={mockReason} />}
      <DashboardView
        pnlSeries={pnlResult.data}
        instructions={instructionsResult.data}
        alerts={alertsResult.data}
        rolls={rollsResult.data}
      />
    </>
  )
}
