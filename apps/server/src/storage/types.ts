/**
 * BlobStore：文件本体的存储抽象（Port）。
 * 默认 fs 实现（本地卷）；未来 S3 兼容实现（Garage/MinIO/R2）时实现同一接口即可，
 * 见 docs/BACKEND.md。
 */
import type { Readable } from 'node:stream'

export interface BlobStore {
  /**
   * data 接受 Node Readable 或 Blob（File）。
   * Blob 是两运行时通吃的载体：R2 原生接受 Blob（流式、带长度）；
   * fs 实现内部转 Readable 落盘。
   */
  put: (key: string, data: Readable | Blob) => Promise<{ size: number }>
  get: (key: string) => Promise<Readable>
  delete: (key: string) => Promise<void>
}

export function isBlobStore(x: unknown): x is BlobStore {
  const b = x as BlobStore
  return typeof b?.put === 'function' && typeof b?.get === 'function' && typeof b?.delete === 'function'
}

/**
 * key 安全校验：段内允许 [a-z0-9.-]，不允许 .. 逃逸与空段。
 * key 由服务端生成（uuid + 可选扩展名，可能带分桶目录前缀），此为纵深防御。
 */
export function safeKey(key: string): string {
  if (!/^[a-z0-9][a-z0-9.-]*(?:\/[a-z0-9][a-z0-9.-]*)*$/i.test(key) || key.includes('..'))
    throw new Error(`unsafe blob key: ${key}`)
  return key
}
