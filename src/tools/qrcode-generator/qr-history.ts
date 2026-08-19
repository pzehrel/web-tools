import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'web-tools:qrcode-history'
const MAX_ITEMS = 50

export interface QrHistoryItem {
  id: string
  /** 用户自选的名称，可为空字符串 */
  name: string
  text: string
  time: number
}

function load(): QrHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw)
      return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed))
      return []
    return parsed
      .filter(
        (item): item is QrHistoryItem =>
          typeof item === 'object'
          && item !== null
          && typeof (item as QrHistoryItem).id === 'string'
          && typeof (item as QrHistoryItem).text === 'string'
          && typeof (item as QrHistoryItem).time === 'number',
      )
      // 兼容旧版记录（无 name 字段）
      .map(item => ({ ...item, name: typeof item.name === 'string' ? item.name : '' }))
  }
  catch {
    return []
  }
}

/** 二维码工具的手动保存记录：存 localStorage，同内容去重并置顶 */
export function useQrHistory() {
  const [items, setItems] = useState<QrHistoryItem[]>(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    }
    catch {
      // 存储满或被禁用时静默失败，记录功能降级为内存态
    }
  }, [items])

  const add = useCallback((name: string, text: string) => {
    const value = text.trim()
    if (!value)
      return
    setItems(prev => [
      { id: crypto.randomUUID(), name: name.trim(), text: value, time: Date.now() },
      ...prev.filter(item => item.text !== value),
    ].slice(0, MAX_ITEMS))
  }, [])

  const rename = useCallback((id: string, name: string) => {
    setItems(prev => prev.map(item => (item.id === id ? { ...item, name: name.trim() } : item)))
  }, [])

  const remove = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  return { items, add, rename, remove, clear }
}
