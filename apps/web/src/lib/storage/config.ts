/**
 * 存储配置：服务器地址本身是设备级偏好，存 localStorage。
 * 当前为占位实现——HttpToolStore 未接入，配置了 serverUrl 也仍落 IndexedDB。
 */

const CONFIG_KEY = 'web-tools:storage-config'

export interface StorageConfig {
  /** 用户手填的服务器地址（可选后端的入口） */
  serverUrl?: string
  token?: string
}

export function readStorageConfig(): StorageConfig {
  if (typeof localStorage === 'undefined')
    return {}
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw)
      return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null)
      return {}
    const cfg = parsed as StorageConfig
    return {
      serverUrl: typeof cfg.serverUrl === 'string' && cfg.serverUrl ? cfg.serverUrl : undefined,
      token: typeof cfg.token === 'string' && cfg.token ? cfg.token : undefined,
    }
  }
  catch {
    return {}
  }
}

export function writeStorageConfig(cfg: StorageConfig): void {
  if (typeof localStorage === 'undefined')
    return
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg))
  }
  catch {
    // 存储被禁用时静默失败
  }
}
