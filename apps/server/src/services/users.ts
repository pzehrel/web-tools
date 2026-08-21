import { randomUUID } from 'node:crypto'
import { and, eq, gt, isNull, lt, or } from 'drizzle-orm'

import type { Db } from '../db/index.ts'
import { assets, sessions, users } from '../db/schema.ts'
import { hashPassword, newSessionToken, sha256, verifyPassword } from '../passwords.ts'

export const SESSION_COOKIE = 'wt_session'
const SESSION_TTL_MS = 30 * 24 * 3600 * 1000 // 30 天

export interface PublicUser {
  id: string
  email: string
}

export class UserService {
  private readonly db: Db

  constructor(db: Db) {
    this.db = db
  }

  async register(email: string, password: string): Promise<PublicUser> {
    const [existing] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
    if (existing)
      throw new AuthError('email already registered', 409)
    const [row] = await this.db
      .insert(users)
      .values({ id: randomUUID(), email, passwordHash: await hashPassword(password) })
      .returning()
    return { id: row.id, email: row.email }
  }

  async login(email: string, password: string): Promise<{ user: PublicUser, token: string }> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
    // 用户不存在也跑一次校验，避免时序侧信道探测邮箱注册与否
    const ok = row
      ? await verifyPassword(password, row.passwordHash)
      : await verifyPassword(password, 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=')
    if (!row || !ok)
      throw new AuthError('invalid email or password', 401)
    const { token, tokenHash } = newSessionToken()
    await this.db.insert(sessions).values({
      id: randomUUID(),
      userId: row.id,
      tokenHash,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    })
    return { user: { id: row.id, email: row.email }, token }
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token)
      return
    await this.db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)))
  }

  /** cookie token → 用户；过期/无效返回 undefined */
  async userFromToken(token: string | undefined): Promise<PublicUser | undefined> {
    if (!token)
      return undefined
    const [row] = await this.db
      .select({ id: users.id, email: users.email })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, new Date())))
      .limit(1)
    return row ?? undefined
  }

  /** 登录/注册后：把当前匿名设备的资产认领到用户名下 */
  async claimDeviceAssets(userId: string, deviceId: string | undefined): Promise<number> {
    if (!deviceId)
      return 0
    const rows = await this.db
      .update(assets)
      .set({ userId })
      .where(and(eq(assets.deviceId, deviceId), isNull(assets.userId)))
      .returning({ id: assets.id })
    return rows.length
  }

  /** 顺手清理过期会话（惰性，无定时任务） */
  async purgeExpiredSessions(): Promise<void> {
    await this.db.delete(sessions).where(or(lt(sessions.expiresAt, new Date())))
  }
}

export class AuthError extends Error {
  readonly status: 401 | 409

  constructor(message: string, status: 401 | 409) {
    super(message)
    this.status = status
  }
}
