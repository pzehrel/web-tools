import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

/**
 * SQLite（D1）版 schema：与 schema.pg.ts 结构同构（表名/列名/属性名完全一致），
 * 是双运行时的第二份方言实现——改表结构时两份必须同步改。
 * 差异仅在方言类型：timestamp → integer({ mode: 'timestamp_ms' })（应用侧 Date ↔ 毫秒整数），
 * 默认值用 $defaultFn（应用侧生成）替代 defaultNow（库侧生成）。
 * NULL 语义与 PG 一致（唯一索引不比较 NULL），assets 的两条唯一索引设计原样成立。
 */

/** 用户：邮箱 + 密码（scrypt）。个人自部署规模够用，不做邮箱验证流。 */
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(), // uuid
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(), // scrypt$N$r$p$salt$hash
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  },
  t => [uniqueIndex('users_email_unique').on(t.email)],
)

/** 会话：不透明 token，库存 sha256(token)，可主动吊销（logout/改密）。 */
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(), // uuid
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  },
  t => [
    uniqueIndex('sessions_token_hash_unique').on(t.tokenHash),
    index('sessions_user_idx').on(t.userId),
  ],
)

/**
 * 素材/历史记录元数据表。
 * 文件本体存 BlobStore（Workers 上为 R2），这里只存 blobKey 引用。
 * 归属：登录用户（user_id）或匿名设备（device_id）；登录时匿名数据会被认领到用户。
 */
export const assets = sqliteTable(
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
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  },
  t => [
    // 匿名态：device_id 非空时保证同设备同工具内 id 唯一
    uniqueIndex('assets_device_tool_id').on(t.deviceId, t.toolId, t.id),
    // 登录态：device_id 为 NULL（SQLite 唯一索引同样不比较 NULL），需独立约束
    uniqueIndex('assets_user_tool_id').on(t.userId, t.toolId, t.id),
    index('assets_user_tool_idx').on(t.userId, t.toolId),
  ],
)
