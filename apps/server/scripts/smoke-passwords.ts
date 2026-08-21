/** 密码哈希单元验证（不依赖 DB） */
import { hashPassword, newSessionToken, sha256, verifyPassword } from '../src/passwords.ts'

const h = await hashPassword('correct horse battery')
console.log('hash-format:', h.split('$').length === 6 ? 'ok ✓' : 'bad ✗')
console.log('verify-ok:', await verifyPassword('correct horse battery', h))
console.log('verify-bad:', await verifyPassword('wrong', h))
console.log('verify-garbage:', await verifyPassword('x', 'not-a-hash'))

const { token, tokenHash } = newSessionToken()
console.log('token-distinct-hash:', token !== tokenHash && sha256(token) === tokenHash ? 'ok ✓' : 'bad ✗')
