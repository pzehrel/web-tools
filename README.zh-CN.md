# Web Tools

[English](README.md)

Web Tools 是一套以浏览器为中心的实用小工具集合，覆盖 URL、二维码、图片帧动画、Lottie 素材、点九图和 CSS 动效。仓库是 pnpm workspace monorepo：静态前端位于 `apps/web/`，可选的 API MVP 位于 `apps/server/`。

## 从这里开始

公开站点当前在浏览器中处理工具输入，前端不会把工具数据上传到服务器。工具记录使用 IndexedDB 保存，主题偏好使用 `localStorage` 保存。可选后端已经实现，但前端 HTTP 存储驱动尚未接入，因此配置服务器地址目前不会让前端从 IndexedDB 切换出去。

环境要求：Node.js 22 和 pnpm 11.7（仓库在 `package.json` 中声明了 `pnpm@11.7.0`）。在仓库根目录执行：

```bash
pnpm install
pnpm dev
```

开发站点地址为 `http://localhost:1420`。如需构建预渲染静态站点并预览构建产物：

```bash
pnpm build
pnpm preview
```

## Workspace 命令

| 命令              | 用途                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------- |
| `pnpm dev`        | 在 1420 端口运行前端开发服务器。                                                         |
| `pnpm build`      | 类型检查，并将所有前端路由构建为静态 HTML。                                              |
| `pnpm preview`    | 使用 Vite 预览 `apps/web/dist/`。                                                        |
| `pnpm dev:server` | 运行 `apps/server/` 中的 Node API；见 [`apps/server/README.md`](apps/server/README.md)。 |
| `pnpm dev:worker` | 在本地运行 Cloudflare Workers API；见 [`apps/server/README.md`](apps/server/README.md)。 |
| `pnpm lint`       | 运行仓库级 ESLint 配置。                                                                 |
| `pnpm typecheck`  | 对每个 workspace 包执行类型检查。                                                        |
| `pnpm test`       | 对每个 workspace 包执行测试。                                                            |
| `pnpm release`    | 创建并推送仓库的 CalVer 发版标签。                                                       |

## 可用工具

首页当前展示工具注册表中状态为 `ready` 的工具：

| 工具         | 路由                     | 用途                                                                          |
| ------------ | ------------------------ | ----------------------------------------------------------------------------- |
| URL 与二维码 | `/tools/url-qrcode`      | 递归解析 URL 和路径，编辑嵌套参数，并在 URL 文本与二维码之间互转。            |
| 帧动画       | `/tools/frame-animation` | 导入图片帧，调整播放参数，预览动画，并导出 sprite CSS/LESS/SCSS。             |
| Lottie 预览  | `/tools/lottie-preview`  | 预览 Lottie 素材包，将引用的图片优化为图集，并导出仍可由 Lottie 播放的 ZIP。  |
| 点九图       | `/tools/nine-patch`      | 定义四条切线，预览 `border-image`，导出 CSS/SCSS/Less，并可选导出更小的 PNG。 |
| CSS 扫光     | `/tools/css-shine`       | 调整扫光动效，并为卡片、按钮、徽章或透明图片复制独立 CSS。                    |

旧路由 `/tools/qrcode-generator` 和 `/tools/url-parser` 会重定向到 `/tools/url-qrcode`。字体工具箱已有实现和路由，但状态为 `hidden`，不会显示在首页。

## 仓库结构

```text
apps/web/                 # React 前端、SSG 路由和浏览器端工具
apps/server/              # 可选 Hono API：Node/Postgres/fs 或 Workers/D1/R2
docs/BACKEND.md           # 后端与存储架构决策
docs/DESIGN.md            # 新粗野主义 UI 规范
scripts/release.mjs       # CalVer 发版脚本
wrangler.jsonc            # 静态前端 Worker 配置
```

如需了解前端路由、SSG、存储和新增工具规则，请阅读 [`apps/web/README.zh-CN.md`](apps/web/README.zh-CN.md)。如需开发 API 或配置 Cloudflare 资源，请阅读 [`apps/server/README.zh-CN.md`](apps/server/README.zh-CN.md)。设计系统见 [`docs/DESIGN.md`](docs/DESIGN.md)，后端决策和兼容性边界见 [`docs/BACKEND.md`](docs/BACKEND.md)。

## 构建与部署

`pnpm build` 会执行前端 TypeScript 项目构建和仓库自定义的 SSG 入口，生成位于 `apps/web/dist/` 下的嵌套路由产物。根目录 `wrangler.jsonc` 将该目录作为 Cloudflare Workers 静态资产发布。

GitHub Actions 会在部署前运行 lint、类型检查、测试和构建。Pull request 以及推送到 `main` 会上传预览版本；`v*` 标签会部署生产版本。生产自定义域名配置在 Cloudflare 中，而不是写入 `wrangler.jsonc`。该工作流也会部署可选 API Worker，并在发版标签时应用远程 D1 迁移；API 前置条件见 [`apps/server/README.zh-CN.md`](apps/server/README.zh-CN.md)。

## 参与贡献

保持能在浏览器完成的处理仍在浏览器中完成，遵守 SSG 水合约束，并遵循 [`docs/DESIGN.md`](docs/DESIGN.md) 中的 UI 规范。workspace 命令请使用 pnpm。提交改动前运行 `pnpm lint`、`pnpm typecheck`、`pnpm test` 和 `pnpm build`。
