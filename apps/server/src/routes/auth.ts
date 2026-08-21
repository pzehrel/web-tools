import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { createFactory } from 'hono/factory'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

import type { AppEnv } from '../app-env.ts'
import { identity } from '../auth.ts'
import { rateLimit } from '../rate-limit.ts'
import { AuthError, SESSION_COOKIE, type UserService } from '../services/users.ts'

const factory = createFactory<AppEnv>()

const credentialsSchema = z.object({
  email: z.string().email().max(128),
  password: z.string().min(8).max(128),
})

// auth 端点限流：每 IP 每分钟 10 次（注册登录共用，防暴破/防批量注册）
const authRateLimit = rateLimit({ key: 'auth', limit: 10, windowMs: 60_000 })

/** Cookie 属性：HttpOnly（JS 不可读）+ SameSite=Lax（防 CSRF 基线）+ Secure（HTTPS） */
const cookieOpts = {
  httpOnly: true,
  sameSite: 'Lax',
  secure: true,
  path: '/',
  maxAge: 30 * 24 * 3600,
} as const

/**
 * /api/auth 路由。
 * 注册/登录需要 X-Device-ID（用于认领匿名资产），身份中间件在 auth 之外的场景生效。
 */
export function authRoute(users: UserService) {
  const register = factory.createHandlers(
    authRateLimit,
    zValidator('json', credentialsSchema),
    async (c) => {
      const { email, password } = c.req.valid('json')
      const deviceId = c.req.header('X-Device-ID')
      const user = await users.register(email, password)
      const claimed = await users.claimDeviceAssets(user.id, deviceId)
      // 注册即登录
      const { token } = await users.login(email, password)
      setCookie(c, SESSION_COOKIE, token, cookieOpts)
      return c.json({ user, claimed }, 201)
    },
  )

  const login = factory.createHandlers(
    authRateLimit,
    zValidator('json', credentialsSchema),
    async (c) => {
      const { email, password } = c.req.valid('json')
      const deviceId = c.req.header('X-Device-ID')
      const { user, token } = await users.login(email, password)
      const claimed = await users.claimDeviceAssets(user.id, deviceId)
      setCookie(c, SESSION_COOKIE, token, cookieOpts)
      return c.json({ user, claimed })
    },
  )

  const logout = factory.createHandlers(async (c) => {
    await users.logout(getCookie(c, SESSION_COOKIE))
    deleteCookie(c, SESSION_COOKIE, { path: '/' })
    return c.json({ ok: true })
  })

  const me = factory.createHandlers(
    identity(users),
    async (c) => {
      return c.json({
        authenticated: Boolean(c.get('user')),
        user: c.get('user') ?? null,
        anonymous: c.get('identity').deviceId ?? null,
      })
    },
  )

  return new Hono<AppEnv>()
    .post('/register', ...register)
    .post('/login', ...login)
    .post('/logout', ...logout)
    .get('/me', ...me)
}

export { AuthError }
