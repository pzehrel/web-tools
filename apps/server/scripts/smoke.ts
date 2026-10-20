/**
 * 冒烟：验证路由注册、身份中间件、错误路径。
 * 自适应 DB 状态：先探活，DB 可达（200）走业务断言，不可达（503）走降级断言。
 */
import { buildNodeApp } from '../src/index.ts'

const app = buildNodeApp()

const h = await app.request('/api/health')
const dbUp = h.status === 200
console.log('health:', h.status, dbUp ? '(DB 可达，走业务断言)' : h.status === 503 ? '(DB 不可达，走降级断言)' : '(✗ 意外状态)')

const noAuth = await app.request('/api/assets?tool=x')
console.log('no-auth:', noAuth.status, noAuth.status === 401 ? '(期望 401 ✓)' : '(✗)')

const badDevice = await app.request('/api/assets?tool=x', { headers: { 'X-Device-ID': 'short' } })
console.log('bad-device-id:', badDevice.status, badDevice.status === 401 ? '(期望 401 ✓)' : '(✗)')

const expectDb = dbUp ? 200 : 503
const authed = await app.request('/api/assets?tool=demo', { headers: { 'X-Device-ID': 'device-abc12345' } })
console.log('authed-list:', authed.status, authed.status === expectDb ? `(期望 ${expectDb} ✓)` : '(✗)')

const noTool = await app.request('/api/assets', { headers: { 'X-Device-ID': 'device-abc12345' } })
console.log('all-tools-list:', noTool.status, noTool.status === expectDb ? `(tool 省略=跨工具列表合法，期望 ${expectDb} ✓)` : '(✗)')

// auth 路由：非法 body 被 zod 拦（400）；合法 body 视注册开关/DB 状态：
// 开关关（默认）→ 403；开关开 + DB 可达 → 201/409；开关开 + DB 不可达 → 503
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
const okRegister = dbUp
  ? [201, 403, 409].includes(register.status)
  : [403, 503].includes(register.status)
console.log('register:', register.status, okRegister ? '(201/409=已开注册，403=注册关闭（默认），503=DB 掉线 ✓)' : '(✗)')

const me = await app.request('/api/auth/me')
console.log('me(no-auth):', me.status, me.status === 401 ? '(期望 401 ✓)' : '(✗)')

const meAnon = await app.request('/api/auth/me', { headers: { 'X-Device-ID': 'device-abc12345' } })
const meBody = meAnon.status === 200 ? await meAnon.json() as { authenticated: boolean } : null
console.log('me(anon):', meAnon.status, meAnon.status === 200 && meBody && !meBody.authenticated ? '(匿名身份 200 + authenticated:false ✓)' : '(✗)')

// CORS：配置的前端源放行，未知源不放行
const corsOk = await app.request('/api/health', { headers: { Origin: 'http://localhost:1420' } })
console.log('cors-dev-origin:', corsOk.headers.get('access-control-allow-origin') === 'http://localhost:1420' ? '(放行 ✓)' : '(✗)')
const corsBad = await app.request('/api/health', { headers: { Origin: 'https://evil.example.com' } })
console.log('cors-unknown-origin:', corsBad.headers.get('access-control-allow-origin') ? '(✗ 不应放行)' : '(不放行 ✓)')
