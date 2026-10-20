import type { AppEnv } from './app-env.ts'
import type { AppDeps } from './deps.ts'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'

import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { assetsRoute } from './routes/assets.ts'
import { authRoute } from './routes/auth.ts'
import { health } from './routes/health.ts'
import { AssetService } from './services/assets.ts'
import { AuthError, UserService } from './services/users.ts'

/**
 * 应用工厂：运行时无关，db/表对象/文件存储/CORS 全部由组合根注入（见 deps.ts）。
 * 测试/调试可 import buildApp() 直接用 app.request() 冒烟，不起端口。
 */
export function buildApp(deps: AppDeps) {
  const users = new UserService(deps.db, deps.tables)
  const svc = new AssetService(deps.db, deps.tables, deps.blobs)
  const app = new Hono<AppEnv>()
  app.use(logger())
  app.use(secureHeaders())

  // 前端主站（webtools.pzehrel.com）与用户自填的 serverUrl 天然跨源；
  // api 子域与主站同 eTLD+1，SameSite=Lax 的会话 cookie 不受限，但仍需 CORS 放行
  app.use('*', cors({
    origin: deps.corsOrigins,
    credentials: true,
    allowHeaders: ['Content-Type', 'X-Device-ID'],
  }))

  // 请求体上限：JSON（登录注册）1MB；multipart（素材上传）100MB。
  // bodyLimit 中间件统一设 100MB，JSON 的收紧由 zod/邮箱密码 max 长度兜底。
  app.use('*', bodyLimit({ maxSize: 100 * 1024 * 1024 }))

  // 集中错误处理：路由内不写 try/catch，异常统一在这里翻译成响应
  app.onError((err, c) => {
    if (err instanceof HTTPException)
      return err.getResponse()
    if (err instanceof AuthError)
      return c.json({ error: err.message }, err.status)
    if (isDbError(err))
      return c.json({ error: 'database unavailable' }, 503)
    console.error('[server] unhandled error:', err)
    return c.json({ error: 'internal error' }, 500)
  })
  app.notFound(c => c.json({ error: 'not found' }, 404))

  app.get('/api/health', () => health(deps.ping))
  app.route('/api/auth', authRoute(users, deps.allowRegistration))
  app.route('/api/assets', assetsRoute(svc, users))
  return app
}

/** pg/drizzle 连接类错误的识别（连接拒绝、超时等）；Drizzle 会包一层 cause，需递归看 */
function isDbError(err: unknown): boolean {
  const codes = new Set(['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', '28P01', '3D000'])
  let cur: unknown = err
  for (let depth = 0; depth < 5 && cur instanceof Error; depth++) {
    if (codes.has((cur as { code?: string }).code ?? ''))
      return true
    cur = (cur as { cause?: unknown }).cause
  }
  return false
}

export type AppType = ReturnType<typeof buildApp>
