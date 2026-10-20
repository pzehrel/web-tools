/**
 * 工具私有存储的领域类型（纯类型，零依赖）。
 *
 * 调用方只面对 ToolStore 接口，不感知数据落在 IndexedDB 还是服务器：
 * 「本地模式」和「服务器模式」是运行时二选一，接口形状不变。
 * 架构决策见 docs/BACKEND.md。
 */

/** 一条工具数据。payload 是本体，meta 放各工具的私有字段（名称、缩略图等），开放结构 */
export interface StoreItem {
  id: string
  toolId: string
  /**
   * 素材本体。小数据直接内联 string（JSON/文本）；
   * 大文件放 Blob——IndexedDB 原生存 Blob，HTTP 驱动走 multipart/FormData，两边自然映射
   */
  payload: string | Blob
  /** 各工具自定义的元数据，不进接口契约 */
  meta: Record<string, unknown>
  /** 可选的 MIME 类型与字节数；字符串 payload 可由驱动自动计算 */
  mimeType?: string
  size?: number
  createdAt: number
  updatedAt: number
}

/**
 * 列表项只携带元数据；小型字符串可以内联返回，大型 Blob 只在 get 时读取。
 * 这对应远端的 metadata row + object storage，也避免列表加载所有文件本体。
 */
export interface StoreItemSummary extends Omit<StoreItem, 'payload'> {
  payload?: string
  hasBlob: boolean
  size: number
}

/**
 * 工具存储接口：故意设计成「最小公约数」。
 *  - 全部 async（IndexedDB 和 HTTP 都是异步，调用方无需关心背后是哪种）
 *  - 不暴露事务、游标、复杂查询——需要过滤就整列表拉回来在前端做
 */
export interface ToolStore {
  /** 按 updatedAt 倒序返回该工具的元数据；Blob payload 只在 get 时读取 */
  list: (toolId: string) => Promise<StoreItemSummary[]>
  get: (toolId: string, id: string) => Promise<StoreItem | undefined>
  /** 同 id 覆盖（upsert） */
  save: (toolId: string, item: StoreItem) => Promise<void>
  remove: (toolId: string, id: string) => Promise<void>
}
