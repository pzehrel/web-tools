import { Readable } from 'node:stream'
import { and, desc, eq } from 'drizzle-orm'

import type { Db } from '../db/index.ts'
import { assets } from '../db/schema.ts'
import { newBlobKey, newId } from '../ids.ts'
import { FsBlobStore } from '../storage/fs.ts'
import type { BlobStore } from '../storage/types.ts'

/** 列表项：不含 payload 本体（本体按需单条拉取） */
export interface AssetSummary {
  id: string
  toolId: string
  hasBlob: boolean
  mimeType: string | undefined
  size: number
  meta: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface AssetBody extends AssetSummary {
  /** string payload 内联返回；Blob 素材返回 null，走 /api/assets/:id/raw */
  payload: string | null
}

interface SaveInput {
  toolId: string
  id?: string
  /** 小数据直接内联（string/JSON） */
  payload?: string
  /** 大文件本体 */
  file?: File
  mimeType?: string
  meta?: Record<string, unknown>
}

function toSummary(r: typeof assets.$inferSelect): AssetSummary {
  return {
    id: r.id,
    toolId: r.toolId,
    hasBlob: r.blobKey !== null,
    mimeType: r.mimeType ?? undefined,
    size: r.size,
    meta: JSON.parse(r.meta) as Record<string, unknown>,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }
}

export class AssetService {
  private readonly db: Db
  private readonly blobs: BlobStore

  constructor(db: Db, blobs: BlobStore = new FsBlobStore()) {
    this.db = db
    this.blobs = blobs
  }

  async list(deviceId: string, toolId: string): Promise<AssetSummary[]> {
    const rows = await this.db
      .select()
      .from(assets)
      .where(and(eq(assets.deviceId, deviceId), eq(assets.toolId, toolId)))
      .orderBy(desc(assets.updatedAt))
      .limit(500)
    return rows.map(toSummary)
  }

  async get(deviceId: string, toolId: string, id: string): Promise<AssetBody | undefined> {
    const [row] = await this.db
      .select()
      .from(assets)
      .where(and(eq(assets.deviceId, deviceId), eq(assets.toolId, toolId), eq(assets.id, id)))
      .limit(1)
    if (!row)
      return undefined
    return {
      ...toSummary(row),
      payload: row.inlinePayload,
    }
  }

  /** 保存（同 id 覆盖，upsert 语义，与前端 save 对齐） */
  async save(deviceId: string, input: SaveInput): Promise<AssetSummary> {
    const id = input.id ?? newId()
    let blobKey: string | undefined
    let inlinePayload: string | undefined
    let mimeType = input.mimeType
    let size = 0

    if (input.file) {
      const ext = (input.file.name.match(/\.[a-z0-9]+$/i)?.[0] ?? '').toLowerCase()
      blobKey = newBlobKey(ext)
      const written = await this.blobs.put(blobKey, Readable.fromWeb(input.file.stream() as never))
      size = written.size
      mimeType = mimeType ?? (input.file.type || undefined)
    }
    else if (input.payload !== undefined) {
      inlinePayload = input.payload
      size = Buffer.byteLength(input.payload, 'utf8')
    }

    const [row] = await this.db
      .insert(assets)
      .values({
        id,
        deviceId,
        toolId: input.toolId,
        inlinePayload,
        blobKey,
        mimeType: mimeType ?? null,
        size,
        meta: JSON.stringify(input.meta ?? {}),
      })
      .onConflictDoUpdate({
        target: assets.id,
        set: {
          inlinePayload,
          blobKey,
          mimeType: mimeType ?? null,
          size,
          meta: JSON.stringify(input.meta ?? {}),
          updatedAt: new Date(),
        },
      })
      .returning()
    return toSummary(row)
  }

  async remove(deviceId: string, toolId: string, id: string): Promise<boolean> {
    const [row] = await this.db
      .delete(assets)
      .where(and(eq(assets.deviceId, deviceId), eq(assets.toolId, toolId), eq(assets.id, id)))
      .returning()
    if (!row)
      return false
    if (row.blobKey)
      await this.blobs.delete(row.blobKey).catch(() => {}) // 元数据已删，blob 清理失败不阻塞
    return true
  }

  /** 取 Blob 本体的流（下载用） */
  async raw(deviceId: string, toolId: string, id: string): Promise<{ stream: ReadableStream<Uint8Array>, mimeType: string | undefined } | undefined> {
    const [row] = await this.db
      .select()
      .from(assets)
      .where(and(eq(assets.deviceId, deviceId), eq(assets.toolId, toolId), eq(assets.id, id)))
      .limit(1)
    if (!row?.blobKey)
      return undefined
    const nodeStream = await this.blobs.get(row.blobKey)
    return {
      stream: Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>,
      mimeType: row.mimeType ?? undefined,
    }
  }
}
