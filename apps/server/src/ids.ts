export function newId(): string {
  return crypto.randomUUID()
}

/** blobKey：uuid，去掉连字符，分桶由 BlobStore 实现按前两位处理 */
export function newBlobKey(ext = ''): string {
  const id = crypto.randomUUID().replace(/-/g, '')
  return ext ? `${id}${ext}` : id
}
