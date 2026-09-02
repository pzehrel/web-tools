import type { StoreItem, StoreItemSummary } from '@/lib/storage/types'
import { useToolStore } from '@/lib/react/use-tool-store'

export const NINE_PATCH_TOOL_ID = 'nine-patch'

export interface NinePatchRecordMeta {
  name: string
  imageName: string
  width: number
  height: number
  slice: { top: number, right: number, bottom: number, left: number }
  imageWidth: { top: number, right: number, bottom: number, left: number }
  outset: number
  fill: boolean
  linkWidth: boolean
  repeatH: 'stretch' | 'repeat' | 'round' | 'space'
  repeatV: 'stretch' | 'repeat' | 'round' | 'space'
  cropEnabled: boolean
  cropKeep: { w: number, h: number }
  codeFormat: 'scss' | 'less' | 'css'
  codeStyle: 'longhand' | 'shorthand'
}

export interface NinePatchRecordSummary extends StoreItemSummary {
  recordName: string
}

function recordName(item: StoreItemSummary): string {
  return typeof item.meta.name === 'string' && item.meta.name.trim()
    ? item.meta.name
    : typeof item.meta.imageName === 'string' && item.meta.imageName.trim()
      ? item.meta.imageName
      : '未命名记录'
}

/** 点九图记录：列表只读元数据，打开记录时再按需取图片 Blob。 */
export function useNinePatchRecords() {
  const store = useToolStore(NINE_PATCH_TOOL_ID)
  const records: NinePatchRecordSummary[] = store.items.map(item => ({ ...item, recordName: recordName(item) }))
  return { ...store, records }
}

export function createNinePatchItem(
  id: string,
  payload: Blob,
  meta: NinePatchRecordMeta,
  now = Date.now(),
): StoreItem {
  return {
    id,
    toolId: NINE_PATCH_TOOL_ID,
    payload,
    meta: { ...meta },
    createdAt: now,
    updatedAt: now,
  }
}
