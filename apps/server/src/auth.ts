import type { AppEnv } from './app-env.ts'
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'

/**
 * 匿名设备认证：请求头 X-Device-ID（前端首次生成 UUID 存 localStorage）。
 * 个人自部署规模下这是最简隔离；升级版认证（passcode/反代层）见 docs/BACKEND.md。
 */
export const deviceId = createMiddleware<AppEnv>(async (c, next) => {
  const id = c.req.header('X-Device-ID')
  if (!id || id.length < 8 || id.length > 64) {
    throw new HTTPException(401, { message: 'missing or invalid X-Device-ID' })
  }
  c.set('deviceId', id)
  await next()
})
