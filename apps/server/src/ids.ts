import { randomUUID } from 'node:crypto'

export function newId(): string {
  return randomUUID()
}

/** blobKey：uuid，去掉连字符，分桶由 FsBlobStore 按前两位处理 */
export function newBlobKey(ext = ''): string {
  const id = randomUUID().replace(/-/g, '')
  return ext ? `${id}${ext}` : id
}
