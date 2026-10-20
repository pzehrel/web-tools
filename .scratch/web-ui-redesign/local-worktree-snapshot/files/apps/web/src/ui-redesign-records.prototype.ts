import type { UrlRecord } from './tools/url-parser/url-records'
/**
 * Complete record UI contracts backed by the disposable prototype database.
 * 所有记录 UI 契约完整保留，使用可清除的独立原型数据库。
 */
import type { StoreItemSummary } from '@/lib/storage/types'
import { useCallback } from 'react'
import { usePrototypeToolStore } from './ui-redesign-use-store.prototype'

const nameOf = (item: StoreItemSummary) => typeof item.meta.name === 'string' && item.meta.name.trim() ? item.meta.name : typeof item.meta.imageName === 'string' ? item.meta.imageName : '未命名项目'

export function useNinePatchRecords() {
  const store = usePrototypeToolStore('nine-patch')
  return { ...store, records: store.items.map(item => ({ ...item, recordName: typeof item.meta.name === 'string' && item.meta.name.trim() ? item.meta.name : typeof item.meta.imageName === 'string' && item.meta.imageName.trim() ? item.meta.imageName : '未命名记录' })) }
}
export function useFrameAnimationRecords() {
  const store = usePrototypeToolStore('frame-animation')
  return { ...store, records: store.items.map(item => ({ ...item, recordName: nameOf(item), frameCount: Array.isArray(item.meta.frames) ? item.meta.frames.length : 0 })) }
}
export function useLottieRecords() {
  const store = usePrototypeToolStore('lottie-preview')
  return { ...store, records: store.items.map(item => ({ ...item, recordName: nameOf(item), projectSize: typeof item.meta.width === 'number' && typeof item.meta.height === 'number' ? `${item.meta.width}×${item.meta.height}` : '' })) }
}
export function useUrlRecords() {
  const store = usePrototypeToolStore('url-parser')
  const { save, remove: removeItem, items: storedItems } = store
  const items = store.items.filter((item): item is StoreItemSummary & { payload: string } => typeof item.payload === 'string').map(item => ({ id: item.id, name: typeof item.meta.name === 'string' ? item.meta.name : '', text: item.payload, time: item.updatedAt }))
  const add = useCallback((text: string, name: string) => {
    if (!text.trim())
      return null
    const id = crypto.randomUUID()
    const now = Date.now()
    void save({ id, toolId: 'url-parser', payload: text.trim(), meta: { name }, createdAt: now, updatedAt: now })
    return id
  }, [save])
  const update = useCallback((id: string, patch: Partial<Pick<UrlRecord, 'name' | 'text'>>) => {
    const current = storedItems.find(item => item.id === id)
    if (!current || typeof current.payload !== 'string')
      return
    const name = patch.name ?? (typeof current.meta.name === 'string' ? current.meta.name : '')
    const text = patch.text ?? current.payload
    if (name === current.meta.name && text === current.payload)
      return
    void save({ ...current, payload: text, meta: { ...current.meta, name }, updatedAt: Date.now() })
  }, [storedItems, save])
  const remove = useCallback((id: string) => {
    void removeItem(id)
  }, [removeItem])
  const clear = useCallback(() => {
    void Promise.all(storedItems.map(item => removeItem(item.id)))
  }, [storedItems, removeItem])
  return { items, add, update, remove, clear, refresh: store.refresh }
}
