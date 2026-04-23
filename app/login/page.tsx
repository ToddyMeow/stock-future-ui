import { Suspense } from "react"
import { LoginView } from "./login-view.client"

export const dynamic = "force-dynamic"

/**
 * /login —— 单 operator 密码登录。
 *
 * URL: /login?redirect=/some/path  （登录成功后跳回 redirect）
 * URL: /login?locked=1             （会话锁屏态：标题 / 副标题切换）
 */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginView />
    </Suspense>
  )
}
