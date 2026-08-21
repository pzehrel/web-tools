/** Hono 环境类型（Variables：中间件注入的请求级上下文） */
export interface AppEnv {
  Variables: {
    /** 匿名设备 ID（auth 中间件从 X-Device-ID 注入） */
    deviceId: string
  }
}
