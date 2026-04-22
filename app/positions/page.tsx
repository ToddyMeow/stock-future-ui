/**
 * app/positions/page.tsx — 当前持仓（RSC）
 *
 * 拉 positions + daily_pnl（用最新一日拿账户权益）+ rolls（Q6 换约候选）。
 * 字段 `unrealized_pnl` / `last_price` 若后端无值，前端回退 0。
 */
import {
  fetchDailyPnl,
  fetchOrMock,
  fetchPositions,
  fetchRolls,
} from "@/lib/api"
import { mockDailyPnl, mockPositions, mockRolls } from "@/lib/mock"
import { MockBanner } from "@/components/mock-banner"
import { PositionsView } from "./positions-view.client"
import { todayStr, shiftDate } from "@/lib/date"

export default async function PositionsPage() {
  const today = todayStr()
  const from = shiftDate(today, -90)

  const [positionsResult, pnlResult, rollsResult] = await Promise.all([
    fetchOrMock(
      () => fetchPositions(),
      () => mockPositions(),
    ),
    fetchOrMock(
      () => fetchDailyPnl(from, today),
      () => mockDailyPnl(90),
    ),
    fetchOrMock(
      () => fetchRolls(),
      () => mockRolls(),
    ),
  ])

  const isMock =
    positionsResult.isMock || pnlResult.isMock || rollsResult.isMock
  const mockReason =
    positionsResult.error ?? pnlResult.error ?? rollsResult.error

  return (
    <>
      {isMock && <MockBanner reason={mockReason} />}
      <PositionsView
        positions={positionsResult.data}
        pnl={pnlResult.data}
        rolls={rollsResult.data}
      />
    </>
  )
}
