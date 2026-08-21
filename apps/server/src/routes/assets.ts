import { Hono } from 'hono'
import { createFactory } from 'hono/factory'
import { zValidator } from '@hono/zod-validator'

import type { AppEnv } from '../app-env.ts'
import { identity } from '../auth.ts'
import { idParamSchema, saveFormSchema, toolQuerySchema } from '../schemas.ts'
import type { AssetService } from '../services/assets.ts'
import type { UserService } from '../services/users.ts'

const factory = createFactory<AppEnv>()

/**
 * /api/assets 路由。
 * 契约见 docs/BACKEND.md：REST 形状是前后端唯一硬约定，
 * 前端经 hc<AppType> 在编译期获得类型（RPC 纯编译期，产物即普通 fetch）。
 */
export function assetsRoute(svc: AssetService, users: UserService) {
  const list = factory.createHandlers(
    identity(users),
    zValidator('query', toolQuerySchema),
    async (c) => {
      const items = await svc.list(c.get('identity'), c.req.valid('query').tool)
      return c.json({ items })
    },
  )

  const save = factory.createHandlers(
    identity(users),
    zValidator('form', saveFormSchema),
    async (c) => {
      const form = c.req.valid('form')
      if (!form.file && form.payload === undefined)
        return c.json({ error: 'file or payload required' }, 400)
      const item = await svc.save(c.get('identity'), {
        toolId: form.toolId,
        id: form.id,
        file: form.file,
        payload: form.payload,
        mimeType: form.mimeType,
        meta: form.meta ? (JSON.parse(form.meta) as Record<string, unknown>) : undefined,
      })
      return c.json(item, 201)
    },
  )

  const get = factory.createHandlers(
    identity(users),
    zValidator('query', toolQuerySchema),
    zValidator('param', idParamSchema),
    async (c) => {
      const item = await svc.get(c.get('identity'), c.req.valid('query').tool, c.req.valid('param').id)
      return item ? c.json(item) : c.json({ error: 'not found' }, 404)
    },
  )

  const raw = factory.createHandlers(
    identity(users),
    zValidator('query', toolQuerySchema),
    zValidator('param', idParamSchema),
    async (c) => {
      const { id } = c.req.valid('param')
      const raw = await svc.raw(c.get('identity'), c.req.valid('query').tool, id)
      return raw
        ? new Response(raw.stream, {
            headers: {
              ...(raw.mimeType ? { 'Content-Type': raw.mimeType } : {}),
              'Cache-Control': 'private, max-age=60',
            },
          })
        : c.json({ error: 'not found' }, 404)
    },
  )

  const remove = factory.createHandlers(
    identity(users),
    zValidator('query', toolQuerySchema),
    zValidator('param', idParamSchema),
    async (c) => {
      const ok = await svc.remove(c.get('identity'), c.req.valid('query').tool, c.req.valid('param').id)
      return ok ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404)
    },
  )

  return new Hono<AppEnv>()
    .get('/', ...list)
    .post('/', ...save)
    .get('/:id', ...get)
    .get('/:id/raw', ...raw)
    .delete('/:id', ...remove)
}
