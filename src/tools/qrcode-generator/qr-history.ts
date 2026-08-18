import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'web-tools:qrcode-history'
const MAX_ITEMS = 50

export type QrHistoryKind = 'encode' | 'decode'

export interface QrHistoryItem {
  id: string
  kind: QrHistoryKind
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
    return parsed.filter(
      (item): item is QrHistoryItem =>
        typeof item === 'object'
        && item !== null
        && typeof (item as QrHistoryItem).id === 'string'
        && typeof (item as QrHistoryItem).text === 'string'
        && typeof (item as QrHistoryItem).time === 'number'
        && ((item as QrHistoryItem).kind === 'encode' || (item as QrHistoryItem).kind === 'decode'),
    )
  }
  catch {
    return []
  }
}

/** 二维码工具的历史记录：存 localStorage，同内容去重并置顶 */
export function useQrHistory() {
  const [items, setItems] = useState<QrHistoryItem[]>(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    }
    catch {
      // 存储满或被禁用时静默失败，历史功能降级为内存态
    }
  }, [items])

  const add = useCallback((kind: QrHistoryKind, text: string) => {
    const value = text.trim()
    if (!value)
      return
    setItems(prev => [
      { id: crypto.randomUUID(), kind, text: value, time: Date.now() },
      ...prev.filter(item => !(item.kind === kind && item.text === value)),
    ].slice(0, MAX_ITEMS))
  }, [])

  const remove = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  return { items, add, remove, clear }
}
