import type { StoreItem, StoreItemSummary } from '@/lib/storage/types'

import { unzipSync, zipSync } from 'fflate'
import { useToolStore } from '@/lib/react/use-tool-store'

export const FRAME_ANIMATION_TOOL_ID = 'frame-animation'

export interface ArchivedFrame {
  path: string
  id: string
  seq: number
  name: string
  selected: boolean
}

export interface FrameAnimationRecordMeta {
  name: string
  frames: ArchivedFrame[]
  fps: number
  direction: 'forward' | 'reverse' | 'pingpong'
  loopInfinite: boolean
  loopCount: number
  range: [number, number] | null
  pixelated: boolean
  alphaThreshold: number
  exportFormat: 'css' | 'less' | 'scss'
  spriteDimension: { axis: 'cols' | 'rows', value: number }
  exportVars: boolean
  exportContainer: boolean
}

export interface FrameArchiveInput {
  id: string
  seq: number
  name: string
  blob: Blob
  selected: boolean
}

export interface FrameAnimationRecordSummary extends StoreItemSummary {
  recordName: string
  frameCount: number
}

function extension(name: string): string {
  const match = name.match(/\.[a-z0-9]+$/i)
  return match?.[0].toLowerCase() ?? '.bin'
}

const MIME_BY_EXTENSION: Record<string, string> = {
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

export async function createFrameArchive(frames: FrameArchiveInput[]): Promise<{ blob: Blob, frames: ArchivedFrame[] }> {
  const entries: Record<string, Uint8Array> = {}
  const archived = await Promise.all(frames.map(async (frame, index) => {
    const path = `frames/${String(index + 1).padStart(4, '0')}${extension(frame.name)}`
    entries[path] = new Uint8Array(await frame.blob.arrayBuffer())
    return { path, id: frame.id, seq: frame.seq, name: frame.name, selected: frame.selected }
  }))
  const zip = zipSync(entries, { level: 6, mtime: new Date(2000, 0, 1) })
  return {
    blob: new Blob([zip as BlobPart], { type: 'application/zip' }),
    frames: archived,
  }
}

export async function extractFrameArchive(blob: Blob): Promise<Map<string, Blob>> {
  const entries = unzipSync(new Uint8Array(await blob.arrayBuffer()))
  return new Map(Object.entries(entries).map(([path, bytes]) => {
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    return [path, new Blob([buffer], { type: MIME_BY_EXTENSION[extension(path)] ?? 'application/octet-stream' })]
  }))
}

function recordName(item: StoreItemSummary): string {
  return typeof item.meta.name === 'string' && item.meta.name.trim() ? item.meta.name : '未命名项目'
}

export function useFrameAnimationRecords() {
  const store = useToolStore(FRAME_ANIMATION_TOOL_ID)
  const records: FrameAnimationRecordSummary[] = store.items.map(item => ({
    ...item,
    recordName: recordName(item),
    frameCount: Array.isArray(item.meta.frames) ? item.meta.frames.length : 0,
  }))
  return { ...store, records }
}

export function createFrameAnimationItem(id: string, payload: Blob, meta: FrameAnimationRecordMeta, now = Date.now()): StoreItem {
  return {
    id,
    toolId: FRAME_ANIMATION_TOOL_ID,
    payload,
    meta: { ...meta },
    createdAt: now,
    updatedAt: now,
  }
}
