import { integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

/**
 * 素材/历史记录元数据表。
 * 文件本体存 BlobStore（fs 卷或 S3），这里只存 blobKey 引用。
 */
export const assets = pgTable(
  'assets',
  {
    id: text('id').primaryKey(), // uuid，前端生成或服务端生成
    deviceId: text('device_id').notNull(), // 匿名设备隔离
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
  ],
)

export type AssetRow = typeof assets.$inferSelect
export type NewAssetRow = typeof assets.$inferInsert
