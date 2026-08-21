import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'

import { env } from '../env.ts'
import * as schema from './schema.ts'

const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  // 个人规模：小连接池足够，避免占用 Postgres 最大连接数
  max: 5,
})

export const db = drizzle(pool, { schema })

export type Db = typeof db
