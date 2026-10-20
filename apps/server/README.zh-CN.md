# @web-tools/server

[English](README.md)

`@web-tools/server` 是用于保存工具素材和历史记录的可选 Hono API MVP。同一份与运行时无关的应用代码可以组装为 Node/Docker 或 Cloudflare Workers 版本。当前前端仍使用 IndexedDB，因此公开前端不会自动使用此 API。

更完整的架构和兼容性边界见 [`../../docs/BACKEND.md`](../../docs/BACKEND.md)。

## 运行时矩阵

| 关注点     | Node / Docker 路径                                     | Cloudflare Workers 路径                                       |
| ---------- | ------------------------------------------------------ | ------------------------------------------------------------- |
| 入口       | `src/index.ts`，使用 `@hono/node-server`               | `src/worker.ts`，导出 `export default { fetch }`              |
| 数据库     | 通过 `pg` 和 `drizzle-orm/node-postgres` 使用 Postgres | 通过 `drizzle-orm/d1` 使用 D1                                 |
| Schema     | `src/db/schema.pg.ts`                                  | `src/db/schema.sqlite.ts`                                     |
| Blob 存储  | `DATA_DIR` 下的 `FsBlobStore`                          | `BUCKET` binding 对应的 `R2BlobStore`                         |
| 配置       | `.env` 和进程环境变量                                  | `apps/server/wrangler.jsonc` 中的 bindings 与 vars            |
| 运行时限制 | 服务端可使用完整 Node API                              | 纯存储子集；Cloudflare Workers 无法运行未来的 Node 子进程任务 |

`src/app.ts` 中的 `buildApp(deps)` 负责共享路由和错误处理。每个入口通过 `src/deps.ts` 注入自己的数据库、schema、Blob 存储、健康检查、CORS 源和注册开关。

## 本地 Node 开发

环境要求：Node.js 22、pnpm，以及一个可连接的 Postgres 数据库。开发默认连接串为 `postgres://webtools:webtools@localhost:5432/webtools`。

在仓库根目录执行：

```bash
pnpm install
cp apps/server/.env.example apps/server/.env
# 如果开发用 Postgres 不在本机，请编辑 DATABASE_URL。
pnpm --filter @web-tools/server db:push
pnpm dev:server
```

Node 服务默认监听 `http://localhost:8787`。`db:push` 用于开发期直接同步 schema。对于基于迁移的改动，请在检查生成的迁移文件后使用 `db:generate` 和 `db:migrate`。`pnpm --filter @web-tools/server start` 会在不监听文件变化的情况下启动一次服务。

Node 环境会读取 `apps/server/.env`，并优先使用 shell 或进程显式注入的变量。默认值定义在 `src/env.ts`：`PORT=8787`、`DATA_DIR=./data/files`、`TRUST_PROXY=0`、本机 Postgres 连接串、生产站点与 localhost 作为 CORS 源，以及关闭注册。

## 本地 Workers 开发

Workers 配置文件是 `apps/server/wrangler.jsonc`。首次运行时，先把 D1 迁移应用到 Wrangler 的本地数据库，再启动 Worker：

```bash
pnpm --filter @web-tools/server db:migrate:d1:local
pnpm dev:worker
```

本地 Worker 同样监听 `http://localhost:8787`。当 `apps/server/.env` 存在时，`wrangler dev` 会将其作为环境输入加载；Worker 使用自己的 D1/R2 bindings 以及 `CORS_ORIGINS`/`ALLOW_REGISTRATION` vars。

运行仓库中的冒烟检查：

```bash
pnpm --filter @web-tools/server exec tsx scripts/smoke.ts
pnpm --filter @web-tools/server exec tsx scripts/smoke-passwords.ts
```

`smoke.ts` 会根据数据库可达或不可达状态调整业务断言，并检查身份认证、CORS 和请求校验路径。`smoke-passwords.ts` 不依赖数据库，检查 scrypt 哈希格式、密码验证和 token 哈希。

## HTTP API

所有 API 错误都使用类似 `{ "error": "not found" }` 的 JSON body。`/api/assets` 请求必须提供有效的 `wt_session` 会话 cookie，或包含 8–64 个字符的 `X-Device-ID` 请求头。有效会话优先；否则请求按匿名设备 ID 隔离。CORS 只允许配置的源，并启用 credentials。

### 认证端点

| 方法   | 路径                 | 请求                                     | 成功响应                                                           | 重要失败情况                                      |
| ------ | -------------------- | ---------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------- |
| `POST` | `/api/auth/register` | JSON `{email, password}`；密码长度 8–128 | `201`，返回 `{user, claimed}` 和有效期 30 天的 `wt_session` cookie | `400` body 非法，`403` 注册关闭，`409` 邮箱已注册 |
| `POST` | `/api/auth/login`    | JSON `{email, password}`                 | `200`，返回 `{user, claimed}` 和有效期 30 天的 `wt_session` cookie | `400` body 非法，`401` 凭据无效                   |
| `POST` | `/api/auth/logout`   | 会话 cookie 可选                         | `200`，返回 `{ok: true}`                                           | —                                                 |
| `GET`  | `/api/auth/me`       | 会话 cookie 或 `X-Device-ID`             | `200`，返回已认证用户或匿名设备信息                                | 未提供任何身份时返回 `401`                        |

会话 cookie 使用 `HttpOnly`、`SameSite=Lax`、`Secure`，作用路径为 `/`；因此按当前配置，浏览器本地认证需要 HTTPS 上下文才能正常使用该 cookie。登录和注册按 IP 限制为每分钟 10 次。登录或注册成功后，会认领所提供设备 ID 下已有的匿名素材，并在 `claimed` 中返回认领数量。

匿名健康检查和素材请求示例：

```bash
curl http://localhost:8787/api/health
curl -H 'X-Device-ID: local-device-123' \
  'http://localhost:8787/api/assets?tool=frame-animation'
```

### 素材端点

| 方法     | 路径                            | 契约                                                                                                                                                                                                                    |
| -------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/health`                   | 服务和数据库探活成功时返回 `{ok:true}`；数据库探活失败时返回 `503` 与 `{ok:false}`。                                                                                                                                    |
| `GET`    | `/api/assets?tool=<id>`         | 列出当前身份下单个工具最多 500 条摘要，按 `updatedAt` 倒序。省略 `tool` 时列出所有工具。                                                                                                                                |
| `POST`   | `/api/assets`                   | 表单字段：必填 `toolId`；字符串使用 `payload`，Blob 使用 `file`；可选 `id`、`mimeType` 和 JSON 字符串 `meta`。`payload` 与 `file` 至少提供一个；如果同时发送，当前 handler 会选择文件路径。同一 `id` 使用 upsert 语义。 |
| `GET`    | `/api/assets/:id?tool=<id>`     | 返回元数据和内联字符串 `payload`。Blob payload 的 `payload` 为 `null`，必须从 raw endpoint 读取。                                                                                                                       |
| `GET`    | `/api/assets/:id/raw?tool=<id>` | 流式返回 Blob 本体；如果有保存的 MIME 类型则带上该类型。                                                                                                                                                                |
| `DELETE` | `/api/assets/:id?tool=<id>`     | 删除元数据，并尝试移除保存的 Blob；作用域内记录不存在时返回 `404`。                                                                                                                                                     |

文件上传示例：

```bash
curl -X POST http://localhost:8787/api/assets \
  -H 'X-Device-ID: local-device-123' \
  -F 'toolId=frame-animation' \
  -F 'file=@./frames.zip;type=application/zip' \
  -F 'meta={"name":"demo"}'
```

请求 body 上限为 100 MiB。列表响应只包含摘要；大型二进制 payload 保存在配置的 BlobStore 中。数据库保存用户、会话和素材元数据，文件本体则保存到本地文件系统或 R2。

## 注册开关

注册默认关闭。创建账号时临时设置 `ALLOW_REGISTRATION=true` 或 `1`，完成后再改回 false。注册关闭期间登录仍然可用。

- Node：设置环境变量或编辑 `apps/server/.env`，然后重启进程。
- Workers：修改 `apps/server/wrangler.jsonc` 中的 `ALLOW_REGISTRATION` var，或使用 `wrangler deploy --var ALLOW_REGISTRATION:true` 部署。

## Cloudflare Workers 部署

Worker 配置使用 D1 binding `DB`、R2 binding `BUCKET`、`nodejs_compat` 和预览 URL。`workers_dev` 已关闭；请在 Cloudflare Worker 设置中配置生产自定义域名，不要将其提交到仓库。

一次性资源准备：

```bash
cd apps/server
wrangler d1 create web-tools-db
# 将返回的 ID 填入 wrangler.jsonc，替换占位 database_id。
wrangler r2 bucket create web-tools-assets
wrangler d1 migrations apply web-tools-db --local --config wrangler.jsonc
wrangler deploy --config wrangler.jsonc
```

首次生产部署前，将 `CORS_ORIGINS` 设置为允许的前端源，并确保 Cloudflare token 具有 Workers Scripts、D1 和 R2 的编辑权限。当 `database_id` 仍为供本地开发使用的全零占位 ID 时，CI 跳过 API 初始化、迁移和部署；前端验证与部署仍会运行。替换该占位 ID 后，发版标签的 CI 会在部署 API Worker 前应用远程 D1 迁移；Pull request 和推送到 `main` 会上传预览版本。

## Schema 改动

Postgres 和 SQLite schema 有意保持结构一致。修改素材、用户或会话字段时：

1. 同时更新 `src/db/schema.pg.ts` 和 `src/db/schema.sqlite.ts`。
2. 分别生成 Postgres 和 D1 迁移。
3. 在本地应用 D1 迁移，并运行冒烟检查。
4. 检查并提交两套迁移文件。

```bash
pnpm --filter @web-tools/server db:generate
pnpm --filter @web-tools/server db:generate:d1
pnpm --filter @web-tools/server db:migrate:d1:local
pnpm --filter @web-tools/server exec tsx scripts/smoke.ts
```

## Docker 状态

Node 路径适合未来制作带 Postgres 和挂载 `DATA_DIR` 的 Node 22 Docker 镜像，但当前包中还不存在 `Dockerfile` 和 `docker-compose.yml`，也不会构建它们。请将 Docker 部署视为预留的打包路径，而不是仓库中已提供的一键部署方案。

## 验证

在修改部署或共享契约前，请在仓库根目录运行完整 workspace 检查：

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

服务端包本身提供类型检查，但没有包级 test script；当前运行时和密码检查请使用上面的两个冒烟脚本。
