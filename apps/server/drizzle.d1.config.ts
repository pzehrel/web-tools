import { defineConfig } from 'drizzle-kit'

/**
 * D1（SQLite 方言）迁移生成配置。
 * 只用于 generate：产出的 SQL 由 wrangler d1 migrations apply 执行（local/remote），
 * drizzle-kit 自身不直连 D1。
 * 与 pg 版（drizzle.config.ts → schema.pg.ts）结构同构，改表结构时两边都要重跑 generate。
 */
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.sqlite.ts',
  out: './drizzle-d1',
})
