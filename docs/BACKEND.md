# 后端与存储架构（调研结论）

> 状态：设计定稿，尚未实施。项目当前仍是纯前端 SSG，本文档是未来接入可选后端时的架构依据。

## 需求背景

- 后端用于存储使用工具时提交的素材，主要目的是**保存历史记录**。
- 后端是**可选的**：没有后端时用 IndexedDB 保存在浏览器本地。
- 部分工具配置存 localStorage（现状，维持不变）。
- 服务器地址由用户在页面上**手动填写**，服务端部署位置不是架构约束（大概率 Docker 自部署）。
- 前端代码架构需要**抹平 Web 数据库（IndexedDB）和服务器数据库的差异**，调用层不感知数据落在哪里。

## 总体分层

```
页面组件 (tools/*)
   ↓ 只依赖 hooks
useToolHistory() 等 hooks（React 绑定，TanStack Query / SWR 包裹）
   ↓ 只依赖接口
Repository 接口（领域层定义，按业务需求建模）
   ↓ 实现
IndexedDbDriver ──┐
                  ├─ 运行时根据用户配置选择（二选一，非同步）
HttpDriver ───────┘
```

核心原则：**接口定义权在领域层，不在驱动层**。`HttpDriver` 去适配接口，而不是让接口迁就某个数据库的能力。

「本地模式」和「服务器模式」是**二选一的运行时状态**，不是叠加的同步关系——不做 sync 引擎、不做冲突解决，复杂度刚好卡在「可选后端」这个产品形态上。

## 三层存储分工

| 数据                  | 存哪                          | 说明                               |
| --------------------- | ----------------------------- | ---------------------------------- |
| 工具配置（偏好设置）  | `localStorage`（维持现状）    | 设备级偏好，换设备不跟随，不同步   |
| 历史记录元数据 + 素材 | `IndexedDB`（无后端时的默认） | 唯一 source of truth，离线永远可用 |
| 云端备份 / 跨设备     | 用户填写的服务器（可选）      | 有就切换过去，没有不影响任何功能   |

## 前端：存储抽象层（Adapter 模式）

### 核心接口

按数据形态拆两类接口，不用一个接口覆盖所有东西：

```ts
// src/lib/storage/types.ts

/** 工具配置：小、同步语义、设备本地 */
export interface PrefsStore {
  get<T>(key: string): T | undefined
  set<T>(key: string, value: T): void
}

/**
 * 历史记录 + 素材：大、异步、可换后端。
 * 故意设计成「最小公约数」：
 *  - 全部 async（IndexedDB 和 HTTP 都是异步）
 *  - 不暴露事务、游标、复杂查询——真需要过滤就整列表拉回来在前端做
 */
export interface HistoryRepo {
  list(toolId: string): Promise<HistoryItem[]>
  get(toolId: string, id: string): Promise<HistoryItem | undefined>
  save(toolId: string, item: HistoryItem): Promise<void>
  remove(toolId: string, id: string): Promise<void>
}

export interface HistoryItem {
  id: string
  toolId: string
  /** 素材本体。小数据直接内联（string/JSON）；
      大文件放 Blob——IndexedDB 原生存 Blob，
      HTTP 驱动走 multipart/FormData，两边都能自然映射 */
  payload: string | Blob
  meta: Record<string, unknown>   // 名称、大小、缩略图等，各工具自定义
  createdAt: number
  updatedAt: number
}
```

关键设计决策：

1. **`payload` 用 `string | Blob` 联合类型**：抹平两边的枢纽。IndexedDB 原生存 Blob；HTTP 驱动把 Blob 放 FormData、string 放 JSON 字段。调用方自己知道该存哪种，不需要转换层。
2. **接口里没有 `sync()` / `push()`**：因为不是离线优先的同步架构，是二选一的运行时模式。
3. **`meta` 是开放的 `Record<string, unknown>`**：各工具的私有数据塞这里，不用改架构。

### 运行时选择驱动

```ts
// src/lib/storage/config.ts —— 服务器配置本身存 localStorage（设备级偏好）
export interface StorageConfig {
  serverUrl?: string    // 用户手填
  token?: string
}

// src/lib/storage/index.ts
export function createHistoryRepo(): HistoryRepo {
  const cfg = readStorageConfig()
  return cfg.serverUrl
    ? new HttpHistoryRepo(cfg)
    : new IndexedDbHistoryRepo()
}
```

配置变更时机：用户改了服务器地址后，简单做法是 `location.reload()`（个人工具站可接受，推荐）；讲究做法是 repo 经 React Context 下发，配置变化时换 key 强制重挂载。

### 驱动实现要点

**IndexedDbDriver**

- 原生 API 就 4 个操作，可不引依赖；要舒服可加 `idb`（~1KB）。
- 一个 db、一个 object store，`toolId` 做索引，`keyPath: ['toolId', 'id']`。
- 顺手做 legacy 迁移：把 `url-parser` 现在存 localStorage 的记录导入（参考现有 `LEGACY_QR_KEY` 迁移先例），顺带解决 localStorage ~5MB 容量上限。

**HttpDriver**

- 四个方法一一映射 REST：`GET/POST/DELETE /api/assets`。
- `payload` 是 Blob 时用 `FormData`。
- 需要能力探测：构造时或首次请求 `GET /api/health`，失败（网络错误 / 非 2xx）给出明确信号，让 UI 能显示「服务器不可达」状态——可选后端体验的关键，不能只抛错误。

### React 集成

- `<StorageProvider>` 包在 root-layout 内层（`<ClientOnly>` 之下），提供 repos + 服务器状态 `{ mode: 'local' | 'remote', reachable: boolean }`。
- hooks 内部用 TanStack Query（或 SWR）包 repo 调用：`save` 后自动 invalidate、列表 loading 态、错误冒泡——两个驱动共用同一份代码。
- SSG 约束不变：读存储的组件继续 `<ClientOnly>` 包裹，驱动只在客户端实例化。

### 目录结构（规划）

```
src/lib/storage/
  types.ts          # PrefsStore / HistoryRepo / HistoryItem
  config.ts         # 服务器地址配置（读写 localStorage）
  indexeddb.ts      # IndexedDbHistoryRepo
  http.ts           # HttpHistoryRepo
  prefs.ts          # localStorage 版 PrefsStore（现状的直接抽象）
  index.ts          # createHistoryRepo() 工厂
src/lib/react/
  storage-provider.tsx
  use-tool-history.ts
```

## API 契约（前后端唯一「硬」约定）

```
GET    /api/health           # 能力探测
POST   /api/assets           # 保存（multipart 或 JSON）
GET    /api/assets?tool=xx   # 列表
GET    /api/assets/:id       # 详情 / 下载
DELETE /api/assets/:id       # 删除
```

对前端的承诺只有接口形状；后端是什么技术栈、文件存哪里、有没有数据库，前端不感知。

## 后端：技术栈与 BlobStore 抽象

### 框架：Hono + RPC（已定）

- **Hono**：轻量零依赖，Node/Bun/Workers 通吃（匹配部署位置不定的需求），TS 原生，multipart/FormData 是内置能力。
- **Hono RPC（`hc<AppType>`）**：前后端同一套代码协同开发，只有自部署域名不同——这正是 RPC 模式的标准用法。
  - RPC 是**纯编译期魔法**：`AppType` 是 `import type` 纯类型，编译后完全擦除，构建产物就是普通 `fetch` 调用，对服务器零额外要求。
  - `hc<AppType>(cfg.serverUrl)`：类型安全在编译期建立，baseUrl 运行时注入，两头兼得。
  - 免掉手写 zod schema 描述 REST 契约的重复劳动。
- **不做运行时 zod 校验**——版本兼容责任边界：**前后端同版本配对，各自部署整体**。自己的前端配自己的后端；别人部署旧版是他的事（他一样可以部署配套的前端页面）。用户手填地址指向的是自己控制的实例，版本配对由部署者保证。错误处理只剩「服务器不可达 / 正常工作」两种状态。

### 工程布局

```
web-tools/                 (pnpm workspace)
├─ src/                    # 现有前端
├─ server/                 # Hono 后端，导出 AppType 供前端 import type
└─ packages/shared/        # HistoryItem 等领域类型（可选）
```

- 领域类型（`HistoryItem` 等）放 shared 包，后端 route 的响应类型引用它——**领域层定义权**不变，两端共同引用。
- 前端 `HistoryRepo` 抽象原样保留：IndexedDB 驱动不知道任何后端存在，HTTP 驱动内部用 `hc<AppType>`。抽象抹平「有没有服务器」，RPC 优化「有服务器时怎么调」，两者不冲突。

### ORM：Drizzle

- 轻量：无代码生成步骤、无独立 query engine 二进制，容器镜像小、冷启动快（Prisma 的 client + native engine 架构在 Docker 单机自部署下是实打实的负担）。
- schema 即 TypeScript，查询长得像 SQL；本项目元数据就一张 `assets` 表，Prisma 的优势（复杂关系、studio 可视化）用不上。
- 能跑在 Workers 的 D1 上（如果哪天部署到 Cloudflare），Prisma 对边缘运行时支持别扭。

### 数据库：Postgres（已定）

- **默认 Postgres**：docker-compose 加一个 `postgres:17-alpine`（~30MB 内存基线），换并发、多副本余地、`pg_dump` 备份生态。
- SQLite 的「只支持个人使用」实指并发写入：单容器单进程 + 低频写入场景下它完全够，但既然多副本 / 迁移的可能性不排除，直接上 Postgres，成本差小到可以忽略。
- SQLite（better-sqlite3）保留为极简部署备选；Drizzle 的 `sqlite-core` / `pg-core` schema 几乎同构，切换成本约等于改一个 import + 重跑 migration——这正是选 Drizzle 不选 Prisma 的对冲价值。

元数据表一张：

```ts
// assets：id、toolId、deviceId、mime、size、blobKey（fs/s3 的 key）、createdAt、updatedAt
```

### 文件存储：Port 抽象 + 两档

后端内部做 Port，元数据与文件分离（数据库不存文件本体）：

```ts
interface BlobStore {
  put(key: string, data: Readable): Promise<void>
  get(key: string): Promise<Readable>
  delete(key: string): Promise<void>
}

class FsBlobStore implements BlobStore   // 本地卷，默认
class S3BlobStore implements BlobStore    // Garage/MinIO/R2，env 切换
```

### 第一档：本地卷 + 后端直管（默认，推荐起步）

```
后端容器
 ├─ Postgres          → 元数据（key、mime、size、toolId、时间）
 └─ /data/files/ab/cd/<uuid>.png   → 文件本体（volume 挂载）
```

- key 用内容 hash 或 uuid，按前两位分桶目录避免单目录文件过多。
- 上传走后端、下载由后端代理返回（顺便鉴权）。
- 单机 Docker 自部署下这一档很可能就是终态。

### 第二档：S3 兼容服务（需要解耦 / 多实例时）

docker-compose 加一个 S3 兼容存储服务，env 切换 `STORAGE_DRIVER=s3`：

| 选型       | 特点                                                   |
| ---------- | ------------------------------------------------------ |
| **Garage** | 轻量（几十 MB 内存），S3 API，为自部署设计，自部署首选 |
| MinIO      | 最成熟、生态最好，但偏重（内存基线高），社区版 AGPL    |
| SeaweedFS  | 快，但 API 自己一套 + S3 网关，心智负担略高            |

S3 API 是事实标准：今天接 Garage，明天换 MinIO 或迁 Cloudflare R2，驱动代码不动。

实现细节：S3 版 `get` 不要 302 重定向到预签名 URL（暴露内网地址 + 鉴权旁路），由后端代理流式转发，或后端动态签发短时效 URL。

### 不推荐的方案

- 文件 base64 存数据库。
- NFS / Nextcloud 之类（不是给程序用的对象存储）。
- 永远单机跑还为「像 OSS」而 OSS——第一档加 MinIO 是纯增加运维面。

## 未来预留（当前不实施）

以下均为**设计预留**，当前范围锁定「存数据」。列在这里是为了让现在的决策不堵死未来的路。

### 目录结构终稿（monorepo）

将来出现第二个前端（管理后台）或独立 server 时，迁移为：

```
web-tools/                 (pnpm workspace: apps/*, packages/*)
├─ apps/
│  ├─ web/                 # 现有前端整体 git mv 迁入（SSG 链路不变）
│  ├─ server/              # Hono：API + BlobStore + Drizzle
│  │  ├─ src/
│  │  │  ├─ index.ts       # export type AppType
│  │  │  ├─ routes/        # assets.ts（jobs.ts、admin.ts 为未来预留）
│  │  │  ├─ jobs/          # 预留：任务模型 + executors/
│  │  │  ├─ storage/       # BlobStore: fs.ts / s3.ts
│  │  │  └─ db/            # drizzle schema
│  │  └─ Dockerfile
│  └─ admin/               # 预留：管理后台 SPA（纯 CSR，server 伺服，不进主站）
├─ packages/shared/        # HistoryItem 等领域类型，多端引用
└─ scripts/                # 仓库级脚本
```

- 管理后台是**独立 SPA**（由 server 静态伺服 + 认证中间件），不混入 SSG 主站——主站保持零认证纯静态。
- 迁移顺序：先 `git mv` 前端并修路径（`pnpm build` + 水合验证）→ workspace 化 → server 骨架 → admin 最后。
- 在此之前，server 可先以旁挂目录（方案 A）起步，迁移到 `apps/` 不破坏 API。

### 服务器侧任务（jobs）

未来某些工具可能依赖服务器环境跑重处理（转码、字体、GIF 等）。预留的形态：

- **API**：`POST /api/jobs` → jobId；`GET /api/jobs/:id` 轮询状态/进度；`GET /api/jobs/:id/result` 取产物（落 BlobStore）。
- **队列**：Postgres 当队列（jobs 表：status/progress/error/resultKey），不引入 Redis。
- **执行器三档**：WASM/JS 进程内（如 subset-font、sharp）→ CLI 子进程（ffmpeg、gifsicle、pyftsubset）→ Python sidecar（最后手段）。
- **原则：浏览器能做的不上服务器**（如 fontTools 子集化浏览器内已有 WASM 同源方案），server 只接 Web 跑不动的活。
- **镜像双 tag**：`slim`（纯存储）/ `full`（带处理工具链），Dockerfile 多阶段分层。

### 运行时：Node（已定，因 jobs 而定）

jobs 需要 `child_process` / 流 / 信号处理的成熟度 → Node 22。Bun 的优势（启动快）对常驻进程无感。副作用：Cloudflare Workers 跑不了子进程，**CF 路线降级为「纯存储子集」**（无 jobs）。

## 认证（按需最简化）

个人工具站不需要完整用户系统：

- **匿名设备 ID（推荐起步）**：首次生成 UUID 存 localStorage，请求带上，服务端按 `device_id` 隔离数据，零登录摩擦。
- 升级版：简单 passcode 换 token，或 Cloudflare Access / 反代层保护 API。

## 兼容性边界（「特殊用法」的兜底）

整个架构里唯一「硬」的东西是 `HistoryRepo` 四个方法的形状和 REST 端点形状，其它全是软约束：

- 工具配置留在 localStorage，不同步、不接管。
- 服务器地址是运行时配置，随时可切、随时可断。
- 没有用户体系要求。
- 数据模型只有 `toolId + payload + meta`，`meta` 开放。

能标准化的部分走接口，不能标准化的部分塞 `meta` 和 `payload`，都不用改架构。哪天连接口形状都不适配，改的也只是一层驱动实现，页面代码不动。

## 实施时的注意事项

- `url-parser` 的 localStorage 历史迁到 IndexedDB adapter（参考 `LEGACY_QR_KEY` 先例）。
- SSG 约束：读存储的 UI 继续 `<ClientOnly>`，避免 hydration 不一致。
- 若部署到 Cloudflare Workers：仅支持「纯存储子集」（D1 元数据 + R2 素材，无 jobs——Workers 无法跑子进程）。
- 自部署 Docker：compose 挂 `./data/files:/data/files` + `postgres:17-alpine`（数据卷 `./data/pg`），第二档时再加 Garage 服务。
