import { Readable } from 'node:stream'

import type { BlobStore } from './types.ts'
import { safeKey } from './types.ts'

/**
 * R2 实现（Cloudflare Workers 运行时）。
 * BlobStore 接口的 Node Readable 在这里与 R2 的 Web Stream 互转
 * （nodejs_compat 下 Readable.fromWeb/toWeb 均可用）。
 */
export class R2BlobStore implements BlobStore {
  private readonly bucket: R2Bucket

  constructor(bucket: R2Bucket) {
    this.bucket = bucket
  }

  async put(key: string, data: Readable | Blob): Promise<{ size: number }> {
    // Blob 直接交给 R2（原生支持，流式且带长度）；
    // Node Readable 转换出的流无长度信息，R2 拒绝，须缓冲为 ArrayBuffer
    const body = data instanceof Blob
      ? data
      : await new Response(Readable.toWeb(data) as unknown as ReadableStream).arrayBuffer()
    const obj = await this.bucket.put(safeKey(key), body)
    return { size: obj?.size ?? 0 }
  }

  async get(key: string): Promise<Readable> {
    const obj = await this.bucket.get(safeKey(key))
    if (!obj)
      throw new Error(`blob not found: ${key}`)
    return Readable.fromWeb(obj.body as never)
  }

  async delete(key: string): Promise<void> {
    await this.bucket.delete(safeKey(key))
  }
}
