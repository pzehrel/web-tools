/**
 * localStorage 遗产数据的解析与转换（纯函数，可单测）。
 *
 * 背景：「URL 与二维码」工具的历史记录曾存 localStorage
 * （含更早的独立「二维码工具」key），IndexedDB 驱动首次打开时一次性迁入。
 * 这里只放纯转换逻辑，副作用（读 localStorage / 写 IndexedDB）在 indexeddb.ts。
 */

import type { StoreItem } from './types'

/** 「URL 与二维码」工具合并前的 localStorage key */
export const LEGACY_URL_KEY = 'web-tools:url-parser-history'
/** 更早的独立「二维码工具」key */
export const LEGACY_QR_KEY = 'web-tools:qrcode-history'
/** 遗产数据迁入后的归属工具 */
export const LEGACY_TOOL_ID = 'url-parser'

export interface LegacyUrlRecord {
  id: string
  /** 记录名；旧自动历史没有该字段，解析时补空串 */
  name: string
  text: string
  time: number
}

/** 解析 localStorage 里的旧记录数组；坏数据返回空数组 */
export function parseLegacyUrlRecords(raw: string | null): LegacyUrlRecord[] {
  if (!raw)
    return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  }
  catch {
    return []
  }
  if (!Array.isArray(parsed))
    return []
  return parsed
    .filter(
      (item): item is Omit<LegacyUrlRecord, 'name'> & { name?: unknown } =>
        typeof item === 'object'
        && item !== null
        && typeof (item as LegacyUrlRecord).id === 'string'
        && typeof (item as LegacyUrlRecord).text === 'string'
        && typeof (item as LegacyUrlRecord).time === 'number',
    )
    .map(item => ({ ...item, name: typeof item.name === 'string' ? item.name : '' }))
}

/**
 * 合并两 key 的遗产记录：二维码记录并入 URL 记录，按 text 去重（URL 侧优先），
 * 转换成 StoreItem（payload = text，name 进 meta）。createdAt/updatedAt 沿用旧 time。
 */
export function legacyToStoreItems(urlRaw: string | null, qrRaw: string | null): StoreItem[] {
  const urlRecords = parseLegacyUrlRecords(urlRaw)
  const qrRecords = parseLegacyUrlRecords(qrRaw)
    .filter(item => !urlRecords.some(existing => existing.text === item.text))
  return [...urlRecords, ...qrRecords].map(record => ({
    id: record.id,
    toolId: LEGACY_TOOL_ID,
    payload: record.text,
    meta: { name: record.name },
    createdAt: record.time,
    updatedAt: record.time,
  }))
}
