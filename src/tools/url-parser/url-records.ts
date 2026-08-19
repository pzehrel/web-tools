import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'web-tools:url-parser-history'
const MAX_ITEMS = 50

export interface UrlRecord {
  id: string
  /** 记录名；空串时界面回退展示内容 */
  name: string
  text: string
  time: number
}

function load(): UrlRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw)
      return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed))
      return []
    return parsed
      .filter(
        (item): item is UrlRecord =>
          typeof item === 'object'
          && item !== null
          && typeof (item as UrlRecord).id === 'string'
          && typeof (item as UrlRecord).text === 'string'
          && typeof (item as UrlRecord).time === 'number',
      )
      // 兼容旧版自动历史记录：没有 name 字段时补空串（界面回退展示内容）
      .map(item => ({ ...item, name: typeof item.name === 'string' ? item.name : '' }))
  }
  catch {
    return []
  }
}

/** URL 解析工具的记录：主动保存到 localStorage，选中后可同步更新 */
export function useUrlRecords() {
  const [items, setItems] = useState<UrlRecord[]>(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    }
    catch {
      // 存储满或被禁用时静默失败，记录功能降级为内存态
    }
  }, [items])

  /** 主动保存一条记录，返回新记录 id（内容为空时返回 null） */
  const add = useCallback((text: string, name: string): string | null => {
    const value = text.trim()
    if (!value)
      return null
    const id = crypto.randomUUID()
    setItems(prev => [{ id, name, text: value, time: Date.now() }, ...prev].slice(0, MAX_ITEMS))
    return id
  }, [])

  /** 更新记录的名称 / 内容；内容未变化时不更新（避免选中瞬间误刷时间） */
  const update = useCallback((id: string, patch: Partial<Pick<UrlRecord, 'name' | 'text'>>) => {
    setItems(prev => prev.map((item) => {
      if (item.id !== id)
        return item
      const next = { ...item, ...patch }
      if (next.name === item.name && next.text === item.text)
        return item
      return { ...next, time: Date.now() }
    }))
  }, [])

  const remove = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  return { items, add, update, remove, clear }
}
