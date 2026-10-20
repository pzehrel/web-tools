import type { Db } from './db/index.ts'

import type { Tables } from './deps.ts'
import { sql } from 'drizzle-orm'
import { buildApp } from './app.ts'
import { createD1Db } from './db/d1.ts'
import * as sqliteSchema from './db/schema.sqlite.ts'
import { R2BlobStore } from './storage/r2.ts'

/** Workers 绑定（与 wrangler.jsonc 对应） */
export interface Env {
  DB: D1Database
  BUCKET: R2Bucket
  /** 允许跨域携带凭证的前端源，逗号分隔 */
  CORS_ORIGINS?: string
  /** 'true' 开放注册；缺省/其它值关闭 */
  ALLOW_REGISTRATION?: string
}

/**
 * Workers 组合根：D1（sqlite schema）+ R2 BlobStore。
 * db/tables 的类型 canonical 是 pg 版（见 deps.ts），这里做双方言断言；
 * 运行时方言一致性由「d1 session + sqlite 表对象」保证。
 */
export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const db = createD1Db(env.DB)
    const app = buildApp({
      db: db as unknown as Db,
      tables: sqliteSchema as unknown as Tables,
      blobs: new R2BlobStore(env.BUCKET),
      ping: () => db.run(sql`select 1`),
      corsOrigins: (env.CORS_ORIGINS ?? 'https://webtools.pzehrel.com,http://localhost:1420')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
      allowRegistration: env.ALLOW_REGISTRATION === 'true' || env.ALLOW_REGISTRATION === '1',
    })
    return app.fetch(request, env, ctx)
  },
}
