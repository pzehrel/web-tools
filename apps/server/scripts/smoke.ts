/** 无数据库冒烟：验证路由注册、auth 中间件、错误路径（不依赖 Postgres）。 */
import { buildApp } from '../src/index.ts'

const app = buildApp()

const h = await app.request('/api/health')
console.log('health(no-db):', h.status, '(期望 503，数据库不可达)')

const noAuth = await app.request('/api/assets?tool=x')
console.log('no-auth:', noAuth.status, noAuth.status === 401 ? '(期望 401 ✓)' : '(✗)')

const badDevice = await app.request('/api/assets?tool=x', { headers: { 'X-Device-ID': 'short' } })
console.log('bad-device-id:', badDevice.status, badDevice.status === 401 ? '(期望 401 ✓)' : '(✗)')

const authed = await app.request('/api/assets?tool=demo', { headers: { 'X-Device-ID': 'device-abc12345' } })
console.log('authed-list(no-db):', authed.status, authed.status === 503 ? '(DB 掉线正确翻译为 503 ✓)' : '(✗)')

const noTool = await app.request('/api/assets', { headers: { 'X-Device-ID': 'device-abc12345' } })
console.log('missing-tool:', noTool.status, noTool.status === 400 ? '(期望 400 ✓)' : '(✗)')
