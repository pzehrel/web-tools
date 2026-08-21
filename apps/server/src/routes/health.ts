import { sql } from 'drizzle-orm'

import { db } from '../db/index.ts'

/**
 * 能力探测：前端 HTTP 驱动构造/首请求时调用。
 * 200 = 服务 + 数据库均可用；数据库不可达时 503。
 */
export async function health(): Promise<Response> {
  try {
    await db.execute(sql`select 1`)
    return Response.json({ ok: true })
  }
  catch {
    return Response.json({ ok: false }, { status: 503 })
  }
}
