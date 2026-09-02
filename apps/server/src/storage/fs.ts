import { createWriteStream } from 'node:fs'
import { mkdir, rm, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import { env } from '../env.ts'
import type { BlobStore } from './types.ts'
import { safeKey } from './types.ts'

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

  async put(key: string, data: Readable | Blob): Promise<{ size: number }> {
    const file = this.path(key)
    await mkdir(dirname(file), { recursive: true })
    const stream = data instanceof Blob ? Readable.fromWeb(data.stream() as never) : data
    await pipeline(stream, createWriteStream(file))
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
