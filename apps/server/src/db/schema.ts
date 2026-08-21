import { index, integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

/** 用户：邮箱 + 密码（scrypt）。个人自部署规模够用，不做邮箱验证流。 */
export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(), // uuid
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(), // scrypt$N$r$p$salt$hash
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [uniqueIndex('users_email_unique').on(t.email)],
)

/** 会话：不透明 token，库存 sha256(token)，可主动吊销（logout/改密）。 */
export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(), // uuid
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [
    uniqueIndex('sessions_token_hash_unique').on(t.tokenHash),
    index('sessions_user_idx').on(t.userId),
  ],
)

/**
 * 素材/历史记录元数据表。
 * 文件本体存 BlobStore（fs 卷或 S3），这里只存 blobKey 引用。
 * 归属：登录用户（user_id）或匿名设备（device_id）；登录时匿名数据会被认领到用户。
 */
export const assets = pgTable(
  'assets',
  {
    id: text('id').primaryKey(), // uuid，前端生成或服务端生成
    deviceId: text('device_id'), // 匿名设备隔离（登录后仍保留，用于认领/溯源）
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }), // 登录归属
    toolId: text('tool_id').notNull(),
    /** 小数据（string payload）直接内联；大文件为 null，本体在 BlobStore */
    inlinePayload: text('inline_payload'),
    blobKey: text('blob_key'),
    mimeType: text('mime_type'),
    size: integer('size').notNull().default(0),
    /** 开放元数据（JSON 文本），各工具自定义 */
    meta: text('meta').notNull().default('{}'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [
    uniqueIndex('assets_device_tool_id').on(t.deviceId, t.toolId, t.id),
    index('assets_user_tool_idx').on(t.userId, t.toolId),
  ],
)

export type UserRow = typeof users.$inferSelect
export type SessionRow = typeof sessions.$inferSelect
export type AssetRow = typeof assets.$inferSelect
export type NewAssetRow = typeof assets.$inferInsert
