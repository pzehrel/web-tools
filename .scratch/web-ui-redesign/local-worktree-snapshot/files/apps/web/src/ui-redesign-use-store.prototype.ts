import type { StoreItem, StoreItemSummary } from '@/lib/storage/types'

/**
 * Original record binding with an isolated prototype driver.
 * 保留原记录绑定契约，驱动替换为独立原型数据库。
 */
import { useCallback, useEffect, useState } from 'react'
import { createPrototypeStore } from './ui-redesign-store.prototype'

export interface UseToolStoreResult {
  items: StoreItemSummary[]
  /** 首次列表加载中 */
  loading: boolean
  save: (item: StoreItem) => Promise<void>
  get: (id: string) => Promise<StoreItem | undefined>
  remove: (id: string) => Promise<void>
  refresh: () => Promise<void>
}

export function usePrototypeToolStore(toolId: string): UseToolStoreResult {
  const store = createPrototypeStore()
  const [items, setItems] = useState<StoreItemSummary[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setItems(await store.list(toolId))
    }
    catch {
      // 存储不可用（隐私模式 / 被禁用）时降级为空列表，不阻塞工具使用
    }
  }, [store, toolId])

  useEffect(() => {
    let alive = true
    setLoading(true)
    store.list(toolId)
      .then((list) => {
        if (alive)
          setItems(list)
      })
      .catch(() => {})
      .finally(() => {
        if (alive)
          setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [store, toolId])

  const save = useCallback(async (item: StoreItem) => {
    await store.save(toolId, item)
    await refresh()
  }, [store, toolId, refresh])

  const get = useCallback((id: string) => store.get(toolId, id), [store, toolId])

  const remove = useCallback(async (id: string) => {
    await store.remove(toolId, id)
    await refresh()
  }, [store, toolId, refresh])

  return { items, loading, save, get, remove, refresh }
}
