import { serve } from '@hono/node-server'
import process from 'node:process'
import { sql } from 'drizzle-orm'

import { buildApp } from './app.ts'
import { db } from './db/index.ts'
import * as tables from './db/schema.pg.ts'
import type { AppDeps } from './deps.ts'
import { env } from './env.ts'
import { FsBlobStore } from './storage/fs.ts'

/**
 * Node 组合根（Docker / 本地 tsx）：pg 连接池 + pg schema + 本地卷 BlobStore。
 * Workers 组合根见 worker.ts。
 */
export function buildNodeDeps(): AppDeps {
  return {
    db,
    tables,
    blobs: new FsBlobStore(env.dataDir),
    ping: () => db.execute(sql`select 1`),
    corsOrigins: env.corsOrigins,
    allowRegistration: env.allowRegistration,
  }
}

export function buildNodeApp() {
  return buildApp(buildNodeDeps())
}

export type { AppType } from './app.ts'

// 仅在直接执行（tsx/node）时起 HTTP 服务；被 import 时不生效
if (import.meta.url === `file://${process.argv[1]}`) {
  const { port } = env
  serve({ fetch: buildNodeApp().fetch, port }, (info) => {
    console.log(`[server] http://localhost:${info.port} (db: ${env.databaseUrl.replace(/\/\/.*@/, '//***@')})`)
  })
}
