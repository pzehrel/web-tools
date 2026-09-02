import { zipSync } from 'fflate'

import type { StoreItem, StoreItemSummary } from '@/lib/storage/types'
import { useToolStore } from '@/lib/react/use-tool-store'
import type { AtlasOptions, LoadedLottieProject } from './types'

export const LOTTIE_PREVIEW_TOOL_ID = 'lottie-preview'

export interface LottieRecordMeta {
  name: string
  projectName: string
  width: number
  height: number
  frameRate: number
  imageCount: number
  options: AtlasOptions
  optimizationEnabled: boolean
  library: 'lottie-react' | 'lottie-web'
  renderer: 'canvas' | 'svg'
  loop: boolean
  speed: number
  direction: 1 | -1
  fit: 'meet' | 'slice'
}

export interface LottieRecordSummary extends StoreItemSummary {
  recordName: string
  projectSize: string
}

function normalizeArchivePath(path: string): string {
  const segments: string[] = []
  for (const segment of path.replaceAll('\\', '/').split('/')) {
    if (!segment || segment === '.')
      continue
    if (segment === '..') {
      segments.pop()
      continue
    }
    segments.push(segment)
  }
  return segments.join('/')
}

export async function createLottieArchive(project: LoadedLottieProject): Promise<Blob> {
  const entries: Record<string, Uint8Array> = {
    'data.json': new TextEncoder().encode(JSON.stringify(project.animation, null, 2)),
  }
  for (const image of project.images.values()) {
    if (image.asset.e === 1 || image.asset.p?.startsWith('data:'))
      continue
    const path = normalizeArchivePath(`${image.asset.u ?? ''}${image.asset.p ?? image.sourceName}`)
    if (path)
      entries[path] = new Uint8Array(await image.blob.arrayBuffer())
  }
  const zip = zipSync(entries, { level: 6 })
  return new Blob([zip as BlobPart], { type: 'application/zip' })
}

function recordName(item: StoreItemSummary): string {
  return typeof item.meta.name === 'string' && item.meta.name.trim() ? item.meta.name : '未命名项目'
}

export function useLottieRecords() {
  const store = useToolStore(LOTTIE_PREVIEW_TOOL_ID)
  const records: LottieRecordSummary[] = store.items.map(item => ({
    ...item,
    recordName: recordName(item),
    projectSize: typeof item.meta.width === 'number' && typeof item.meta.height === 'number'
      ? `${item.meta.width}×${item.meta.height}`
      : '',
  }))
  return { ...store, records }
}

export function createLottieItem(id: string, payload: Blob, meta: LottieRecordMeta, now = Date.now()): StoreItem {
  return {
    id,
    toolId: LOTTIE_PREVIEW_TOOL_ID,
    payload,
    meta: { ...meta, options: { ...meta.options } },
    createdAt: now,
    updatedAt: now,
  }
}
