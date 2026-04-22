/**
 * app/analytics/page.tsx — 分析（RSC）
 *
 * 2026-04-20：切到真后端 `/api/analytics/breakdown`。
 * MVP 期后端返空 {by_symbol:[], by_group:[]} — 实盘 fills 表空时是自然空，
 * analytics-view 会展示"暂无数据"占位；有成交后后端升级聚合 SQL。
 *
 * 仍保留 fetchOrMock 降级（后端真断开时走 mockAnalyticsBreakdown = 空骨架 + 红色 banner）。
 */
import { fetchAnalyticsBreakdown, fetchOrMock } from "@/lib/api"
import { mockAnalyticsBreakdown } from "@/lib/mock"
import { MockBanner } from "@/components/mock-banner"
import { AnalyticsView } from "./analytics-view.client"

export default async function AnalyticsPage() {
  const result = await fetchOrMock(
    () => fetchAnalyticsBreakdown(),
    () => mockAnalyticsBreakdown(),
  )

  return (
    <>
      {result.isMock && <MockBanner reason={result.error} />}
      <AnalyticsView data={result.data} />
    </>
  )
}
