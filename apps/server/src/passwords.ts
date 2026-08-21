import { createHash, randomBytes, scrypt as _scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(_scrypt) as (
  pw: string,
  salt: Buffer,
  len: number,
  options: { N: number, r: number, p: number },
) => Promise<Buffer>

const DEFAULTS = { N: 16384, r: 8, p: 1, keylen: 32 } as const

/** 生成 `scrypt$N$r$p$salt_b64$hash_b64` 格式的密码哈希 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const { N, r, p, keylen } = DEFAULTS
  const key = await scrypt(password, salt, keylen, { N, r, p })
  return ['scrypt', N, r, p, salt.toString('base64'), key.toString('base64')].join('$')
}

/** 按存储参数重算并常数时间比较 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt')
    return false
  const N = Number(parts[1])
  const r = Number(parts[2])
  const p = Number(parts[3])
  const salt = Buffer.from(parts[4], 'base64')
  const expected = Buffer.from(parts[5], 'base64')
  if (![N, r, p].every(Number.isInteger) || N <= 0 || r <= 0 || p <= 0)
    return false
  try {
    const key = await scrypt(password, salt, expected.length, { N, r, p })
    return key.length === expected.length && timingSafeEqual(key, expected)
  }
  catch {
    return false
  }
}

/** 会话 token：32 字节随机，DB 存 sha256 */
export function newSessionToken(): { token: string, tokenHash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: sha256(token) }
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}
