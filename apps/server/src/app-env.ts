/** Hono 环境类型（Variables：中间件注入的请求级上下文） */
import type { Identity } from './identity.ts'
import type { PublicUser } from './services/users.ts'

export interface AppEnv {
  Variables: {
    /** 身份：登录用户或匿名设备（identity 中间件注入） */
    identity: Identity
    /** 登录用户信息（仅 session 有效时存在） */
    user?: PublicUser
  }
}
