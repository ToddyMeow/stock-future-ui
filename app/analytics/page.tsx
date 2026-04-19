/**
 * app/analytics/page.tsx — 分析（RSC）
 *
 * 后端暂无归因聚合端点（/api/reports/{date} 只拿当日指令 + equity_series）。
 * 当前整页走 mock；顶部 banner 说明原因，待后端 P1d 补齐后切真数据。
 */
import { mockAnalyticsBreakdown } from "@/lib/mock"
import { MockBanner } from "@/components/mock-banner"
import { AnalyticsView } from "./analytics-view.client"

export default async function AnalyticsPage() {
  const data = mockAnalyticsBreakdown()
  return (
    <>
      <MockBanner reason="后端归因聚合端点未就绪，暂用 mock" />
      <AnalyticsView data={data} />
    </>
  )
}
