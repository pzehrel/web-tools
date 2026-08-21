import { createMiddleware } from 'hono/factory'
import { getCookie } from 'hono/cookie'

import type { AppEnv } from './app-env.ts'
import type { Identity } from './identity.ts'
import type { PublicUser, UserService } from './services/users.ts'
import { SESSION_COOKIE } from './services/users.ts'

/**
 * 身份中间件：session cookie 优先（登录用户），否则回落 X-Device-ID（匿名）。
 * 二者皆无 → 401。注入 identity（owner 维度）与可选 user。
 */
export function identity(users: UserService) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = await users.userFromToken(getCookie(c, SESSION_COOKIE))
    if (user) {
      c.set('identity', { userId: user.id } satisfies Identity)
      c.set('user', user satisfies PublicUser)
    }
    else {
      const deviceId = c.req.header('X-Device-ID')
      if (deviceId && deviceId.length >= 8 && deviceId.length <= 64)
        c.set('identity', { deviceId } satisfies Identity)
    }
    if (!c.get('identity'))
      return c.json({ error: 'authentication required (session cookie or X-Device-ID)' }, 401)
    await next()
  })
}
