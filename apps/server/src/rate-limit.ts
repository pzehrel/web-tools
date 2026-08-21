import { createMiddleware } from 'hono/factory'

import type { AppEnv } from './app-env.ts'

/**
 * 进程内固定窗口限流（自部署单实例够用；多实例时换 Redis/共享存储）。
 * 用于 auth 端点防暴破。
 */
export function rateLimit(opts: { key: string, limit: number, windowMs: number }) {
  const hits = new Map<string, { count: number, resetAt: number }>()

  return createMiddleware<AppEnv>(async (c, next) => {
    const ip = c.req.header('X-Forwarded-For')?.split(',')[0].trim() ?? 'unknown'
    const key = `${opts.key}:${ip}`
    const now = Date.now()
    let bucket = hits.get(key)

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + opts.windowMs }
      hits.set(key, bucket)
    }
    bucket.count++

    if (bucket.count > opts.limit) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000)
      c.header('Retry-After', String(retryAfter))
      return c.json({ error: 'too many requests' }, 429)
    }

    // 惰性清理过期桶，防内存缓慢增长
    if (hits.size > 10_000) {
      for (const [k, v] of hits) {
        if (v.resetAt <= now)
          hits.delete(k)
      }
    }

    await next()
  })
}
