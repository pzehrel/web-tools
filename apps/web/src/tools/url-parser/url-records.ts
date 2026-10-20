/**
 * 「URL 与二维码」工具的记录 hook：对组件保持原有 API，
 * 内部委托 useToolStore——记录落到 IndexedDB（未来接服务器后自动切换），
 * 组件不感知存储位置。localStorage 旧数据由驱动首次打开时迁移（见 lib/storage/legacy.ts）。
 */

import type { StoreItemSummary } from '@/lib/storage/types'

import { useCallback } from 'react'
import { useToolStore } from '@/lib/react/use-tool-store'

const TOOL_ID = 'url-parser'

export interface UrlRecord {
  id: string
  /** 记录名；空串时界面回退展示内容 */
  name: string
  text: string
  time: number
}

function toUrlRecord(item: StoreItemSummary): UrlRecord | null {
  if (typeof item.payload !== 'string')
    return null
  const { name } = item.meta
  return {
    id: item.id,
    name: typeof name === 'string' ? name : '',
    text: item.payload,
    time: item.updatedAt,
  }
}

/** 「URL 与二维码」工具的记录：主动保存，选中后可同步更新 */
export function useUrlRecords() {
  const { items, save, remove, refresh } = useToolStore(TOOL_ID)

  const records = items
    .map(toUrlRecord)
    .filter((item): item is UrlRecord => item !== null)

  /** 主动保存一条记录，返回新记录 id（内容为空时返回 null） */
  const add = useCallback((text: string, name: string): string | null => {
    const value = text.trim()
    if (!value)
      return null
    const id = crypto.randomUUID()
    const now = Date.now()
    void save({
      id,
      toolId: TOOL_ID,
      payload: value,
      meta: { name },
      createdAt: now,
      updatedAt: now,
    })
    return id
  }, [save])

  /** 更新记录的名称 / 内容；内容未变化时不更新（避免选中瞬间误刷时间） */
  const update = useCallback((id: string, patch: Partial<Pick<UrlRecord, 'name' | 'text'>>) => {
    const current = items.find(item => item.id === id)
    if (!current || typeof current.payload !== 'string')
      return
    const nextName = patch.name ?? (typeof current.meta.name === 'string' ? current.meta.name : '')
    const nextText = patch.text ?? current.payload
    if (nextName === current.meta.name && nextText === current.payload)
      return
    void save({
      ...current,
      payload: nextText,
      meta: { ...current.meta, name: nextName },
      updatedAt: Date.now(),
    })
  }, [items, save])

  const removeRecord = useCallback((id: string) => {
    void remove(id)
  }, [remove])

  const clear = useCallback(() => {
    void Promise.all(items.map(item => remove(item.id)))
  }, [items, remove])

  return { items: records, add, update, remove: removeRecord, clear, refresh }
}
