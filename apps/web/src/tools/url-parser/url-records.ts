/**
 * 「URL 与二维码」工具的记录 hook：对组件保持原有 API，
 * 内部委托 useToolStore——记录落到 IndexedDB（未来接服务器后自动切换），
 * 组件不感知存储位置。localStorage 旧数据由驱动首次打开时迁移（见 lib/storage/legacy.ts）。
 */

import type { StoreItem, StoreItemSummary } from '@/lib/storage/types'

import { useCallback, useRef, useState } from 'react'
import { useToolStore } from '@/lib/react/use-tool-store'

const TOOL_ID = 'url-parser'
const PAYLOAD_FORMAT = 'web-tools:url-parser'

export interface UrlTab {
  id: string
  name: string
  text: string
  variables: Record<string, string>
}

export interface UrlWorkspaceSnapshot {
  tabs: UrlTab[]
  activeTabId: string
}

export interface UrlRecord {
  id: string
  /** 记录名；空串时界面回退展示内容 */
  name: string
  time: number
  snapshot: UrlWorkspaceSnapshot
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSnapshot(value: unknown): value is UrlWorkspaceSnapshot {
  if (!isObject(value) || !Array.isArray(value.tabs) || !value.tabs.length || typeof value.activeTabId !== 'string')
    return false
  const ids = new Set<string>()
  for (const tab of value.tabs) {
    if (!isObject(tab) || typeof tab.id !== 'string' || !tab.id || ids.has(tab.id)
      || typeof tab.name !== 'string' || typeof tab.text !== 'string'
      || !isObject(tab.variables) || Object.values(tab.variables).some(value => typeof value !== 'string')) {
      return false
    }
    ids.add(tab.id)
  }
  return ids.has(value.activeTabId)
}

function readSnapshot(payload: string, recordId: string): UrlWorkspaceSnapshot {
  try {
    const parsed: unknown = JSON.parse(payload)
    // 同时核对格式标记、版本和完整结构，避免把普通 JSON 文本误认成整组记录。
    if (isObject(parsed) && Object.keys(parsed).length === 3
      && parsed.format === PAYLOAD_FORMAT && parsed.version === 1 && isSnapshot(parsed.snapshot)) {
      return parsed.snapshot
    }
  }
  catch {
    // 旧记录是任意纯文本，解析失败时保留原文。
  }
  const id = `legacy-${recordId}`
  return { tabs: [{ id, name: '二维码 1', text: payload, variables: {} }], activeTabId: id }
}

function serializeSnapshot(snapshot: UrlWorkspaceSnapshot): string {
  return JSON.stringify({ format: PAYLOAD_FORMAT, version: 1, snapshot })
}

function toUrlRecord(item: StoreItem | StoreItemSummary): UrlRecord | null {
  if (typeof item.payload !== 'string')
    return null
  const { name } = item.meta
  return {
    id: item.id,
    name: typeof name === 'string' ? name : '',
    snapshot: readSnapshot(item.payload, item.id),
    time: item.updatedAt,
  }
}

/** 「URL 与二维码」工具的记录：主动保存，选中后可同步更新 */
export function useUrlRecords() {
  const { items, save, remove, refresh } = useToolStore(TOOL_ID)
  const pendingRef = useRef(new Map<string, StoreItem | null>())
  const writesRef = useRef(new Map<string, Promise<void>>())
  const pendingCountRef = useRef(0)
  const cycleErrorRef = useRef(false)
  const [writeStatus, setWriteStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  for (const [id, item] of pendingRef.current) {
    const stored = items.find(current => current.id === id)
    if (!writesRef.current.has(id) && (item === null
      ? !stored
      : stored?.payload === item.payload
        && stored.updatedAt === item.updatedAt && stored.meta.name === item.meta.name)) {
      pendingRef.current.delete(id)
    }
  }

  const records = items
    .map(toUrlRecord)
    .filter((item): item is UrlRecord => item !== null)
    .sort((a, b) => b.time - a.time)

  /** 同一记录按调用顺序写入，避免保存后立即重命名或删除被旧写入覆盖。 */
  const enqueue = useCallback((id: string, operation: () => Promise<void>) => {
    if (pendingCountRef.current === 0)
      cycleErrorRef.current = false
    pendingCountRef.current++
    setWriteStatus('saving')
    const previous = writesRef.current.get(id)
    const next = (previous ?? Promise.resolve()).catch(() => {}).then(operation)
    writesRef.current.set(id, next)
    void next.catch(() => {
      cycleErrorRef.current = true
      if (writesRef.current.get(id) === next)
        pendingRef.current.delete(id)
    }).finally(() => {
      if (writesRef.current.get(id) === next)
        writesRef.current.delete(id)
      pendingCountRef.current--
      // 全部排队操作完成后才报告结果，同轮后续成功不会掩盖失败。
      if (pendingCountRef.current === 0)
        setWriteStatus(cycleErrorRef.current ? 'error' : 'saved')
    })
  }, [])

  /** 主动保存整组记录，返回新记录 id（所有 Tab 内容为空时返回 null）。 */
  const add = useCallback((snapshot: UrlWorkspaceSnapshot, name: string): string | null => {
    if (!isSnapshot(snapshot) || !snapshot.tabs.some(tab => tab.text.trim()))
      return null
    const id = crypto.randomUUID()
    const now = Date.now()
    const item: StoreItem = {
      id,
      toolId: TOOL_ID,
      payload: serializeSnapshot(snapshot),
      meta: { name },
      createdAt: now,
      updatedAt: now,
    }
    pendingRef.current.set(id, item)
    enqueue(id, () => save(item))
    return id
  }, [save, enqueue])

  /** 更新记录的名称 / 内容；内容未变化时不更新（避免选中瞬间误刷时间）。 */
  const update = useCallback((id: string, patch: Partial<Pick<UrlRecord, 'name' | 'snapshot'>>) => {
    const current = pendingRef.current.has(id) ? pendingRef.current.get(id) : items.find(item => item.id === id)
    if (!current || typeof current.payload !== 'string')
      return
    if (patch.snapshot && (!isSnapshot(patch.snapshot) || !patch.snapshot.tabs.some(tab => tab.text.trim())))
      return
    const currentName = typeof current.meta.name === 'string' ? current.meta.name : ''
    const nextName = patch.name ?? currentName
    const nextPayload = patch.snapshot ? serializeSnapshot(patch.snapshot) : current.payload
    if (nextName === currentName && (nextPayload === current.payload
      || (patch.snapshot && serializeSnapshot(readSnapshot(current.payload, id)) === nextPayload))) {
      return
    }
    // 显式重建写入项，不携带列表中的 size / hasBlob 等派生字段。
    const item: StoreItem = {
      id,
      toolId: TOOL_ID,
      payload: nextPayload,
      meta: { ...current.meta, name: nextName },
      createdAt: current.createdAt,
      updatedAt: Date.now(),
    }
    pendingRef.current.set(id, item)
    enqueue(id, () => save(item))
  }, [items, save, enqueue])

  const removeRecord = useCallback((id: string) => {
    pendingRef.current.set(id, null)
    enqueue(id, () => remove(id))
  }, [remove, enqueue])

  const clear = useCallback(() => {
    const ids = new Set([...items.map(item => item.id), ...pendingRef.current.keys()])
    for (const id of ids)
      removeRecord(id)
  }, [items, removeRecord])

  return { items: records, add, update, remove: removeRecord, clear, refresh, writeStatus }
}
