import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'web-tools:url-parser-history'
/** 旧「二维码工具」的记录 key：工具已合并进 URL 解析，挂载时一次性迁入 */
const LEGACY_QR_KEY = 'web-tools:qrcode-history'
const MAX_ITEMS = 50

export interface UrlRecord {
  id: string
  /** 记录名；空串时界面回退展示内容 */
  name: string
  text: string
  time: number
}

function parseItems(raw: string | null): UrlRecord[] {
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

/**
 * 一次性迁入旧「二维码工具」的记录：合并进本工具的 key 后删除旧 key。
 * 必须在模块加载时执行而非 useState 初始化器里——水合失败时 React 会整树重渲染，
 * 初始化器可能跑两次，第二次读到的旧 key 已被删除，迁移结果会被空数组覆盖。
 */
function migrateLegacyQrRecords(): void {
  try {
    const legacyRaw = localStorage.getItem(LEGACY_QR_KEY)
    if (legacyRaw === null)
      return
    const items = parseItems(localStorage.getItem(STORAGE_KEY))
    const legacy = parseItems(legacyRaw)
      .filter(item => !items.some(existing => existing.text === item.text))
      .sort((a, b) => a.time - b.time)
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...items, ...legacy].slice(0, MAX_ITEMS)))
    localStorage.removeItem(LEGACY_QR_KEY)
  }
  catch {
    // 迁移失败（坏数据 / 存储被禁用）静默跳过，不影响本工具已有记录
  }
}

function load(): UrlRecord[] {
  try {
    return parseItems(localStorage.getItem(STORAGE_KEY))
  }
  catch {
    return []
  }
}

// 模块加载时执行一次性迁移（仅浏览器环境；SSG 预渲染时无 localStorage）
if (typeof localStorage !== 'undefined')
  migrateLegacyQrRecords()

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
