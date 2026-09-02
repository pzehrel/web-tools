/**
 * ToolStore 工厂：运行时按配置选择驱动，模块级单例。
 * 调用方（TS 或 React 层）拿到的都是这同一个实例，不感知背后是哪种驱动。
 */

import type { ToolStore } from './types'
import { readStorageConfig } from './config'
import { IndexedDbToolStore } from './indexeddb'

let instance: ToolStore | null = null

export function createToolStore(): ToolStore {
  if (instance)
    return instance
  const cfg = readStorageConfig()
  if (cfg.serverUrl) {
    // TODO: HttpToolStore（hc<AppType>，见 docs/BACKEND.md）接入后在此切换；
    // 当前无论是否配置服务器地址都落 IndexedDB
  }
  instance = new IndexedDbToolStore()
  return instance
}
