import type { StoreItem, StoreItemSummary } from './types'
import { createToolStore } from './index'

/** 按素材字节定位记录；同一素材重复保存时沿用 id 和创建时间。 */
export async function saveContentRecord<TMeta extends object>(
  toolId: string,
  payload: Blob,
  meta: TMeta,
  currentId: string | null,
  automatic: boolean,
  createItem: (id: string, payload: Blob, meta: TMeta) => StoreItem,
  save: (item: StoreItem) => Promise<void>,
): Promise<{ id: string, saved: boolean }> {
  const digest = await crypto.subtle.digest('SHA-256', await payload.arrayBuffer())
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  const records = await createToolStore().list(toolId)
  const sameContent = records.find(item => item.meta.contentHash === hash)
  if (automatic && sameContent)
    return { id: sameContent.id, saved: false }

  const current = currentId ? records.find(item => item.id === currentId) : undefined
  const existing: StoreItemSummary | undefined = sameContent ?? current
  const id = existing?.id ?? `sha256-${hash}`
  const item = createItem(id, payload, { ...meta, contentHash: hash })
  if (existing)
    item.createdAt = existing.createdAt
  await save(item)
  return { id, saved: true }
}
