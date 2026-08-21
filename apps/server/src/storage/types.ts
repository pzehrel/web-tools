/**
 * BlobStore：文件本体的存储抽象（Port）。
 * 默认 fs 实现（本地卷）；未来 S3 兼容实现（Garage/MinIO/R2）时实现同一接口即可，
 * 见 docs/BACKEND.md。
 */
import { type Readable } from 'node:stream'

export interface BlobStore {
  put(key: string, data: Readable): Promise<{ size: number }>
  get(key: string): Promise<Readable>
  delete(key: string): Promise<void>
}

export function isBlobStore(x: unknown): x is BlobStore {
  const b = x as BlobStore
  return typeof b?.put === 'function' && typeof b?.get === 'function' && typeof b?.delete === 'function'
}
