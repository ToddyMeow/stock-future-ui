/**
 * app/history/page.tsx — 历史查询（RSC）
 *
 * 后端 /api/history?date=YYYY-MM-DD 一次只拿一天。
 * 前端按单日查询（?date=YYYY-MM-DD searchParams）；
 * mock 降级：合成多日视图仅在降级场景下可用。
 */
import { fetchHistory, fetchOrMock } from "@/lib/api"
import { mockInstructions } from "@/lib/mock"
import { MockBanner } from "@/components/mock-banner"
import { HistoryView } from "./history-view.client"
import type { Instruction } from "@/lib/types"
import { todayStr } from "@/lib/date"

type SearchParams = Promise<{ date?: string }>

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const date =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : todayStr()

  const result = await fetchOrMock(
    async () => {
      const res = await fetchHistory(date)
      return res.instructions
    },
    // mock 降级：用 mockInstructions 改写 session_date 为查询日
    (): Instruction[] =>
      mockInstructions().map((r) => ({
        ...r,
        session_date: date,
        id: `${r.id}-${date}`,
      })),
  )

  return (
    <>
      {result.isMock && <MockBanner reason={result.error} />}
      <HistoryView instructions={result.data} date={date} />
    </>
  )
}
