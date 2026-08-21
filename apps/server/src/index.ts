import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { logger } from 'hono/logger'

import type { AppEnv } from './app-env.ts'
import { db } from './db/index.ts'
import { env } from './env.ts'
import { authRoute } from './routes/auth.ts'
import { assetsRoute } from './routes/assets.ts'
import { health } from './routes/health.ts'
import { AssetService } from './services/assets.ts'
import { AuthError, UserService } from './services/users.ts'

/**
 * 应用工厂：测试/调试可 import buildApp() 直接用 app.request() 冒烟，不起端口。
 */
export function buildApp() {
  const users = new UserService(db)
  const svc = new AssetService(db)
  const app = new Hono<AppEnv>()
  app.use(logger())

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
  app.notFound((c) => c.json({ error: 'not found' }, 404))

  app.get('/api/health', () => health())
  app.route('/api/auth', authRoute(users))
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

// 仅在直接执行（tsx/node）时起 HTTP 服务；被 import 时不生效
if (import.meta.url === `file://${process.argv[1]}`) {
  const { port } = env
  serve({ fetch: buildApp().fetch, port }, (info) => {
    console.log(`[server] http://localhost:${info.port} (db: ${env.databaseUrl.replace(/\/\/.*@/, '//***@')})`)
  })
}
