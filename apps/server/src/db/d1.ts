import { drizzle } from 'drizzle-orm/d1'

import * as schema from './schema.sqlite.ts'

/** D1 版 db 工厂：每个请求由 Workers 组合根（worker.ts）用 binding 构造 */
export function createD1Db(binding: D1Database) {
  return drizzle(binding, { schema })
}
