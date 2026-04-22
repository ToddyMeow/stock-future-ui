/**
 * app/universe/page.tsx — 盯盘品种清单（RSC 外壳）
 *
 * 拉 /api/universe 返回 13 品种 final_v3 配置，首次 server-side render；
 * 后端不可达时降级空骨架 + 红色 banner。
 */
import { fetchOrMock, fetchUniverse } from "@/lib/api"
import { mockUniverse } from "@/lib/mock"
import { MockBanner } from "@/components/mock-banner"
import { UniverseView } from "./universe-view.client"

export default async function UniversePage() {
  const { data, isMock, error } = await fetchOrMock(
    () => fetchUniverse(),
    () => mockUniverse(),
  )

  return (
    <>
      {isMock && <MockBanner reason={error} />}
      <UniverseView universe={data} />
    </>
  )
}
