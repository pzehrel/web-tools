/**
 * Isolated disposable prototype database. Never opens production records or legacy keys.
 * 独立可清除的原型数据库；不打开正式记录，也不读取旧记录键。
 */
import type { StoreItem, StoreItemSummary, ToolStore } from './lib/storage/types'

const DB_NAME = 'web-tools-ui-PROTOTYPE-wipe-me'
const DB_VERSION = 2
const STORE = 'items'
const BLOB_STORE = 'blobs'
const TOOL_INDEX = 'by-tool'

interface ItemRecord {
  toolId: string
  id: string
  /** 仅小型字符串内联；Blob 存在 BLOB_STORE */
  payload?: string
  meta: Record<string, unknown>
  mimeType?: string
  size: number
  hasBlob: boolean
  createdAt: number
  updatedAt: number
}

interface BlobRecord {
  toolId: string
  id: string
  blob: Blob
}

/** 模块级缓存：全应用共享一次打开过程（仅使用原型数据库） */
let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise)
    dbPromise = openAndMigrate()
  return dbPromise
}

async function openAndMigrate(): Promise<IDBDatabase> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = (event) => {
      const db = request.result
      const tx = request.transaction!
      const store = db.objectStoreNames.contains(STORE)
        ? tx.objectStore(STORE)
        : db.createObjectStore(STORE, { keyPath: ['toolId', 'id'] })
      if (!store.indexNames.contains(TOOL_INDEX))
        store.createIndex(TOOL_INDEX, 'toolId', { unique: false })
      const blobs = db.objectStoreNames.contains(BLOB_STORE)
        ? tx.objectStore(BLOB_STORE)
        : db.createObjectStore(BLOB_STORE, { keyPath: ['toolId', 'id'] })

      // v1 把 Blob 直接放在 items.payload；升级时搬到独立 store，避免列表读取文件本体。
      if (event.oldVersion < 2) {
        const cursorRequest = store.openCursor()
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result
          if (!cursor)
            return
          const value = cursor.value as Record<string, unknown>
          if (value.payload instanceof Blob) {
            const key = value as unknown as { toolId: string, id: string }
            const blob = value.payload
            blobs.put({ toolId: key.toolId, id: key.id, blob } satisfies BlobRecord)
            delete value.payload
            value.hasBlob = true
            value.mimeType = value.mimeType ?? (blob as Blob).type
            value.size = value.size ?? (blob as Blob).size
          }
          else {
            value.hasBlob = false
            value.size = value.size ?? (typeof value.payload === 'string' ? new TextEncoder().encode(value.payload).length : 0)
          }
          cursor.update(value)
          cursor.continue()
        }
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return db
}

function req<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export class IndexedDbToolStore implements ToolStore {
  async list(toolId: string): Promise<StoreItemSummary[]> {
    const db = await openDb()
    const items = await req(db.transaction(STORE).objectStore(STORE).index(TOOL_INDEX).getAll(toolId) as IDBRequest<ItemRecord[]>)
    return items
      .map(item => ({
        id: item.id,
        toolId: item.toolId,
        ...(typeof item.payload === 'string' ? { payload: item.payload } : {}),
        meta: item.meta,
        mimeType: item.mimeType,
        size: item.size,
        hasBlob: item.hasBlob,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async get(toolId: string, id: string): Promise<StoreItem | undefined> {
    const db = await openDb()
    const item = await req(db.transaction(STORE).objectStore(STORE).get([toolId, id]) as IDBRequest<ItemRecord | undefined>)
    if (!item)
      return undefined
    if (!item.hasBlob) {
      return {
        id: item.id,
        toolId: item.toolId,
        payload: item.payload ?? '',
        meta: item.meta,
        mimeType: item.mimeType,
        size: item.size,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }
    }
    const blobRecord = await req(db.transaction(BLOB_STORE).objectStore(BLOB_STORE).get([toolId, id]) as IDBRequest<BlobRecord | undefined>)
    if (!blobRecord)
      return undefined
    return {
      id: item.id,
      toolId: item.toolId,
      payload: blobRecord.blob,
      meta: item.meta,
      mimeType: item.mimeType,
      size: item.size,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }
  }

  async save(toolId: string, item: StoreItem): Promise<void> {
    const db = await openDb()
    const tx = db.transaction([STORE, BLOB_STORE], 'readwrite')
    const payload = item.payload
    const isBlob = payload instanceof Blob
    const blob = isBlob ? payload : undefined
    const text = isBlob ? undefined : payload
    const size = item.size ?? (blob ? blob.size : new TextEncoder().encode(text!).length)
    tx.objectStore(STORE).put({
      id: item.id,
      toolId,
      ...(isBlob ? {} : { payload: text }),
      meta: item.meta,
      mimeType: item.mimeType ?? (blob?.type || undefined),
      size,
      hasBlob: isBlob,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    } satisfies ItemRecord)
    if (blob) {
      tx.objectStore(BLOB_STORE).put({ toolId, id: item.id, blob } satisfies BlobRecord)
    }
    else {
      tx.objectStore(BLOB_STORE).delete([toolId, item.id])
    }
    await txDone(tx)
  }

  async remove(toolId: string, id: string): Promise<void> {
    const db = await openDb()
    const tx = db.transaction([STORE, BLOB_STORE], 'readwrite')
    tx.objectStore(STORE).delete([toolId, id])
    tx.objectStore(BLOB_STORE).delete([toolId, id])
    await txDone(tx)
  }
}

const prototypeStore = new IndexedDbToolStore()
export function createPrototypeStore(): ToolStore {
  return prototypeStore
}
