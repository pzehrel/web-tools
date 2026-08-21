/** 无数据库冒烟：验证路由注册、身份中间件、错误路径（不依赖 Postgres）。
 * 有 DB 时的完整认证流（注册/登录/认领）待 dev 数据库可达后验证。 */
import { buildApp } from '../src/index.ts'

const app = buildApp()

const h = await app.request('/api/health')
console.log('health(no-db):', h.status, h.status === 503 ? '(期望 503，数据库不可达 ✓)' : '(✗)')

const noAuth = await app.request('/api/assets?tool=x')
console.log('no-auth:', noAuth.status, noAuth.status === 401 ? '(期望 401 ✓)' : '(✗)')

const badDevice = await app.request('/api/assets?tool=x', { headers: { 'X-Device-ID': 'short' } })
console.log('bad-device-id:', badDevice.status, badDevice.status === 401 ? '(期望 401 ✓)' : '(✗)')

const authed = await app.request('/api/assets?tool=demo', { headers: { 'X-Device-ID': 'device-abc12345' } })
console.log('authed-list(no-db):', authed.status, authed.status === 503 ? '(DB 掉线正确翻译为 503 ✓)' : '(✗)')

const noTool = await app.request('/api/assets', { headers: { 'X-Device-ID': 'device-abc12345' } })
console.log('all-tools-list(no-db):', noTool.status, noTool.status === 503 ? '(tool 省略=跨工具列表，合法，DB 掉线 503 ✓)' : '(✗)')

// auth 路由：非法 body 被 zod 拦（400），合法 body 落到 DB 层报 503
const badRegister = await app.request('/api/auth/register', {
  method: 'POST',
  body: JSON.stringify({ email: 'not-an-email', password: '123' }),
  headers: { 'Content-Type': 'application/json' },
})
console.log('register-invalid:', badRegister.status, badRegister.status === 400 ? '(zod 拦截 400 ✓)' : '(✗)')

const register = await app.request('/api/auth/register', {
  method: 'POST',
  body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
  headers: { 'Content-Type': 'application/json', 'X-Device-ID': 'device-abc12345' },
})
console.log('register(no-db):', register.status, register.status === 503 ? '(DB 掉线 503，路由/校验已通过 ✓)' : '(✗)')

const me = await app.request('/api/auth/me')
console.log('me(no-auth):', me.status, me.status === 401 ? '(期望 401 ✓)' : '(✗)')

const meAnon = await app.request('/api/auth/me', { headers: { 'X-Device-ID': 'device-abc12345' } })
const meBody = meAnon.status === 200 ? await meAnon.json() as { authenticated: boolean } : null
console.log('me(anon):', meAnon.status, meAnon.status === 200 && meBody && !meBody.authenticated ? '(匿名身份 200 + authenticated:false ✓)' : '(✗)')
