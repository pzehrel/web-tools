import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'web-tools:url-parser-history'
const MAX_ITEMS = 50

export interface UrlHistoryItem {
  id: string
  text: string
  time: number
}

function load(): UrlHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw)
      return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed))
      return []
    return parsed.filter(
      (item): item is UrlHistoryItem =>
        typeof item === 'object'
        && item !== null
        && typeof (item as UrlHistoryItem).id === 'string'
        && typeof (item as UrlHistoryItem).text === 'string'
        && typeof (item as UrlHistoryItem).time === 'number',
    )
  }
  catch {
    return []
  }
}

/** URL 解析工具的历史记录：存 localStorage，同内容去重并置顶 */
export function useUrlHistory() {
  const [items, setItems] = useState<UrlHistoryItem[]>(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    }
    catch {
      // 存储满或被禁用时静默失败，历史功能降级为内存态
    }
  }, [items])

  const add = useCallback((text: string) => {
    const value = text.trim()
    if (!value)
      return
    setItems(prev => [
      { id: crypto.randomUUID(), text: value, time: Date.now() },
      ...prev.filter(item => item.text !== value),
    ].slice(0, MAX_ITEMS))
  }, [])

  const remove = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  return { items, add, remove, clear }
}
