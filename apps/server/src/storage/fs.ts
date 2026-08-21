import { createWriteStream } from 'node:fs'
import { mkdir, rm, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { type Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import { env } from '../env.ts'
import type { BlobStore } from './types.ts'

/** key 安全校验：只允许 [a-z0-9/] 且不允许 .. 逃逸 */
function safeKey(key: string): string {
  if (!/^[a-z0-9](\/[a-z0-9.-]+)*$/i.test(key) || key.includes('..'))
    throw new Error(`unsafe blob key: ${key}`)
  return key
}

/**
 * 本地卷实现：key 前两位分桶目录，避免单目录文件过多。
 * 目录结构：<dataDir>/ab/<key>
 */
export class FsBlobStore implements BlobStore {
  private readonly root: string

  constructor(root: string = env.dataDir) {
    this.root = root
  }

  private path(key: string): string {
    const k = safeKey(key)
    return join(this.root, k.slice(0, 2), k)
  }

  async put(key: string, data: Readable): Promise<{ size: number }> {
    const file = this.path(key)
    await mkdir(dirname(file), { recursive: true })
    await pipeline(data, createWriteStream(file))
    const { size } = await stat(file)
    return { size }
  }

  async get(key: string): Promise<Readable> {
    const { createReadStream } = await import('node:fs')
    return createReadStream(this.path(key))
  }

  async delete(key: string): Promise<void> {
    await rm(this.path(key), { force: true })
  }
}
