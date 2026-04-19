"use client"

/**
 * components/error-card.tsx — API 失败展示 + 重试
 *
 * 用法：页面层 try/catch 拿到 error 后，渲染 <ErrorCard message={String(err)} />
 * 点击"重试"会触发 router.refresh() 让 RSC 重新拉取数据。
 */
import { useRouter } from "next/navigation"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function ErrorCard({
  message,
  title = "后端请求失败",
}: {
  message: string
  title?: string
}) {
  const router = useRouter()
  return (
    <div className="p-6">
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-red-600 dark:text-red-400">
            {title}
          </CardTitle>
          <CardDescription>
            请检查 FastAPI 是否启动（默认 http://localhost:8000），以及 DB 是否可达
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <pre className="bg-muted p-3 rounded text-xs overflow-x-auto max-h-40">
            {message}
          </pre>
          <div>
            <Button onClick={() => router.refresh()} variant="outline">
              重试
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
