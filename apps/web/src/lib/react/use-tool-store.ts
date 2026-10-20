/**
 * ToolStore 的 React 绑定（唯一的 React 文件，核心层见 lib/storage，纯 TS）。
 *
 * 只做三件事：mount 时拉列表、写操作后刷新、卸载时丢弃在途结果。
 * 不感知驱动类型——接 HTTP 驱动后本文件零改动。
 *
 * SSG 约束：读存储的组件需继续包 <ClientOnly>；本 hook 在预渲染时
 * useEffect 不执行，返回空列表 + loading=true，不会触发 IndexedDB 访问。
 */

import type { StoreItem, StoreItemSummary } from '@/lib/storage/types'

import { useCallback, useEffect, useState } from 'react'
import { createToolStore } from '@/lib/storage'

export interface UseToolStoreResult {
  items: StoreItemSummary[]
  /** 首次列表加载中 */
  loading: boolean
  save: (item: StoreItem) => Promise<void>
  get: (id: string) => Promise<StoreItem | undefined>
  remove: (id: string) => Promise<void>
  refresh: () => Promise<void>
}

export function useToolStore(toolId: string): UseToolStoreResult {
  const store = createToolStore()
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
