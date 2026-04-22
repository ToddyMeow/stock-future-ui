/**
 * app/instructions/page.tsx — 今日指令（RSC）
 *
 * 根据 searchParams 拉 date + session 指令列表，错误降级 mock。
 * 具体交互（回填 / 否决 / 跳过 / 批量）在 instructions-view.client.tsx。
 */
import { fetchInstructions, fetchOrMock } from "@/lib/api"
import { mockInstructions } from "@/lib/mock"
import { MockBanner } from "@/components/mock-banner"
import { InstructionsView } from "./instructions-view.client"
import type { InstructionSession } from "@/lib/types"
import { todayStr } from "@/lib/date"

type SearchParams = Promise<{ date?: string; session?: string }>

export default async function InstructionsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const date =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : todayStr()
  const session: InstructionSession =
    params.session === "night" ? "night" : "day"

  // mock fallback 过滤相同日期（不存在则返回全部）
  const mockFallback = () => {
    const all = mockInstructions()
    // mock 固定在 2026-04-19/day；允许前端筛选出对应记录
    return all.filter(
      (r) =>
        (r.session_date === date || r.session_date === "2026-04-19") &&
        r.session === session,
    )
  }

  const result = await fetchOrMock(
    () => fetchInstructions(date, session),
    mockFallback,
  )

  return (
    <>
      {result.isMock && <MockBanner reason={result.error} />}
      <InstructionsView
        instructions={result.data}
        date={date}
        session={session}
      />
    </>
  )
}
