/**
 * components/mock-banner.tsx — 顶部红色警示条
 *
 * 用法：每页 `isMock === true` 时置顶渲染，提示用户当前数据来自 mock，
 * 避免在实盘环境误以为后端已连。
 */
export function MockBanner({ reason }: { reason?: string }) {
  return (
    <div className="bg-red-600 text-white text-sm px-6 py-2 flex items-center gap-3">
      <span className="font-semibold">后端未连接，展示 mock 数据</span>
      {reason && (
        <span className="text-red-100/90 truncate font-mono text-xs">
          {reason}
        </span>
      )}
    </div>
  )
}
