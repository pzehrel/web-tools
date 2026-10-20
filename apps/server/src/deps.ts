import type { Db } from './db/index.ts'
import type * as schema from './db/schema.pg.ts'
import type { BlobStore } from './storage/types.ts'

/**
 * 应用组合根（buildApp）的运行时依赖。
 * 双运行时（Node/Docker 与 Cloudflare Workers）各自在入口装配：
 *  - Node：node-postgres db + pg schema + FsBlobStore
 *  - Workers：d1 db + sqlite schema + R2BlobStore
 *
 * 类型的 canonical 取 pg 版（db/schema.pg.ts）——服务层按它编程。
 * sqlite schema 与 pg schema 结构同构（表名/列名/属性名一致），
 * Workers 入口处的 `as unknown as` 断言是双方言的唯一代价，
 * 运行时由「d1 session + sqlite 表对象」保证方言一致，类型层不做交叉。
 */
export type Tables = typeof schema

export interface AppDeps {
  db: Db
  tables: Tables
  blobs: BlobStore
  /** 数据库探活（各运行时用自己的驱动方法：pg execute / d1 run） */
  ping: () => Promise<unknown>
  /** 允许跨域携带凭证的前端源（CORS） */
  corsOrigins: string[]
  /** 是否开放注册（默认否；个人站通常只开一次注册自己，随即关闭） */
  allowRegistration: boolean
}
