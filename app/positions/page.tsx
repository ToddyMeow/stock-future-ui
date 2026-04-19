/**
 * app/positions/page.tsx — 当前持仓（RSC）
 *
 * 拉 positions + daily_pnl（用最新一日拿账户权益）。
 * 字段 `unrealized_pnl` / `last_price` 若后端无值，前端回退 0。
 */
import {
  fetchDailyPnl,
  fetchOrMock,
  fetchPositions,
} from "@/lib/api"
import { mockDailyPnl, mockPositions } from "@/lib/mock"
import { MockBanner } from "@/components/mock-banner"
import { PositionsView } from "./positions-view.client"

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}
function shiftDate(d: string, days: number): string {
  return new Date(Date.parse(d) + days * 86400_000)
    .toISOString()
    .slice(0, 10)
}

export default async function PositionsPage() {
  const today = todayStr()
  const from = shiftDate(today, -90)

  const [positionsResult, pnlResult] = await Promise.all([
    fetchOrMock(
      () => fetchPositions(),
      () => mockPositions(),
    ),
    fetchOrMock(
      () => fetchDailyPnl(from, today),
      () => mockDailyPnl(90),
    ),
  ])

  const isMock = positionsResult.isMock || pnlResult.isMock
  const mockReason = positionsResult.error ?? pnlResult.error

  return (
    <>
      {isMock && <MockBanner reason={mockReason} />}
      <PositionsView
        positions={positionsResult.data}
        pnl={pnlResult.data}
      />
    </>
  )
}
