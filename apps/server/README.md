# @web-tools/server

Web 工具集合的可选后端（MVP）。架构决策见 `docs/BACKEND.md`。

技术栈：Hono（+ RPC 类型导出）· Drizzle ORM · Postgres · FsBlobStore（本地卷）。

## 本地开发

```bash
# 仓库根
pnpm install
pnpm dev:server        # tsx watch，默认 http://localhost:8787

# 数据库：export DATABASE_URL 指向可用的 Postgres（如内网 dev 机器）
DATABASE_URL=postgres://webtools:webtools@192.168.x.x:5432/webtools pnpm dev:server

# 建表（开发期用 push 直同步 schema；正式发版改用 generate + migrate）
pnpm --filter @web-tools/server db:push
```

默认值见 `src/env.ts`：`PORT=8787`、`DATABASE_URL=postgres://webtools:webtools@localhost:5432/webtools`、`DATA_DIR=./data/files`。

## API

| 方法   | 路径                          | 说明                                                                                      |
| ------ | ----------------------------- | ----------------------------------------------------------------------------------------- |
| GET    | `/api/health`                 | 探测（数据库不可达返回 503）                                                              |
| GET    | `/api/assets?tool=xx`         | 列表                                                                                      |
| POST   | `/api/assets`                 | 保存（multipart：`toolId` 必填；`file` 或 `payload` 二选一；可选 `id`/`meta`/`mimeType`） |
| GET    | `/api/assets/:id?tool=xx`     | 详情（含内联 payload）                                                                    |
| GET    | `/api/assets/:id/raw?tool=xx` | Blob 本体下载                                                                             |
| DELETE | `/api/assets/:id?tool=xx`     | 删除                                                                                      |

所有 `/api/assets` 路由要求请求头 `X-Device-ID`（匿名设备隔离，见 `src/auth.ts`）。

## 前端对接（RPC）

```ts
import type { AppType } from '@web-tools/server'
import { hc } from 'hono/client'

const client = hc<AppType>(serverUrl)   // serverUrl 运行时注入（用户手填）
```

前后端同版本配对（见 docs/BACKEND.md 兼容性边界），无运行时 zod 校验。

## Docker（预留）

`Dockerfile` / `docker-compose.yml` 为语法预留，当前不构建。目标形态：node:22-slim +
Postgres 17 + `./data/files` 卷；`TRUST_PROXY=1` 给反代场景。
