# @web-tools/web

[English](README.md)

`@web-tools/web` 是 Web Tools 的静态 React 前端。项目使用 Vite、React 19、React Router 和 `vite-react-ssg` 构建为预渲染站点；工具实现运行在浏览器中，不要求后端。

## 开发

请在仓库根目录安装依赖，然后使用根目录脚本运行前端：

```bash
pnpm install
pnpm dev
```

开发服务器使用 `1420` 端口，并启用了 `strictPort`。也可以直接运行包级命令：

```bash
pnpm --filter @web-tools/web dev
pnpm --filter @web-tools/web typecheck
pnpm --filter @web-tools/web test
pnpm --filter @web-tools/web build
```

## 前端架构

- `src/main.tsx` 定义数据路由并启动 `ViteReactSSG`。
- `src/root-layout.tsx` 提供共享的 outlet 和站点操作。
- `src/tools/index.ts` 是首页使用的工具注册表。
- `src/tools/<tool>/index.tsx` 是工具页面，每页自行维护 SEO 元数据。
- `src/lib/storage/` 包含与框架无关的 `ToolStore` 契约和 IndexedDB 实现。
- `src/lib/react/use-tool-store.ts` 是工具记录的 React 绑定层。
- `src/index.scss` 是 Tailwind 入口，也是唯一的全局样式文件；工具专属样式使用 `.scss`。

## 路由

| 路由                     | 组件              | 注册状态 |
| ------------------------ | ----------------- | -------- |
| `/`                      | `App`             | —        |
| `/tools/url-qrcode`      | `url-parser`      | `ready`  |
| `/tools/frame-animation` | `frame-animation` | `ready`  |
| `/tools/lottie-preview`  | `lottie-preview`  | `ready`  |
| `/tools/nine-patch`      | `nine-patch`      | `ready`  |
| `/tools/css-shine`       | `css-shine`       | `ready`  |
| `/tools/font-toolkit`    | `font-toolkit`    | `hidden` |

`/tools/qrcode-generator` 和 `/tools/url-parser` 是指向 `/tools/url-qrcode` 的兼容性重定向。未匹配路由由 fallback 路由渲染首页。

## 静态数据与隐私

当前存储工厂始终返回 `IndexedDbToolStore`。小型字符串 payload 保存在 `items` object store 中；二进制 `Blob` payload 保存在 `blobs` object store 中，只有打开记录时才读取。记录按工具筛选，并按 `updatedAt` 倒序排列。

首次打开 IndexedDB 时，如果存在旧数据，会迁移旧的 URL 和二维码历史 key。只有 IndexedDB 事务成功后才会删除旧 key；遗留数据损坏或存储不可用时会静默跳过，不阻塞工具使用。由于 IndexedDB 和 `localStorage` 都是浏览器 API，依赖存储的读取在 SSG 期间必须保持为仅客户端执行。

存储配置可以记住可选的 `serverUrl`，但当前工厂尚未实现 `HttpToolStore`。在修改工厂并根据 [`apps/server/README.zh-CN.md`](../server/README.zh-CN.md) 完成集成验证之前，不要把远程持久化描述为已可用。

## 新增工具

1. 在 `src/tools/index.ts` 的 `tools` 数组中登记元信息，包括稳定的 kebab-case `id`、面向用户的 `name` 和 `description`、Lucide 图标、`accentClass` 以及正确的 `status`。
2. 在 `src/tools/<tool>/` 下实现页面，并添加页面的 `<Seo>` 元数据。
3. 在 `src/main.tsx` 中使用显式路由 `id` 登记路由，并将同一个 id 加入 `ROUTE_IDS`，确保 SSG 水合数据完整。
4. 如果路由应被公开发现，将其加入 `public/sitemap.xml`。
5. 在适用时复用共享的 `Button`、`Card`、舞台和存储原语。修改 UI 前阅读 [`../../docs/DESIGN.md`](../../docs/DESIGN.md)。

## SSG 约束

自定义入口 `apps/web/scripts/ssg-build.mjs` 会直接等待 Vite 的构建函数完成。请继续使用它，因为上游 CLI 在部分 Node 版本中可能在异步构建完成前退出。当前输出风格为 nested，因此 `/tools/example` 会生成到 `tools/example/index.html`。

每个路由都有固定 id，`customCreateRouter` 会提供相匹配的 `hydrationData.loaderData`。修改路由时必须同步维护这些 id。读取浏览器存储的组件应使用 `ClientOnly` 或等价的仅客户端边界，确保服务端 HTML 与客户端首次渲染保持一致。

## 验证

在仓库根目录执行完整验证：

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

对于路由或水合相关改动，还应使用 `pnpm preview` 伺服构建产物，并确认各路由的 `#root` 下只有一份渲染内容。对于视觉改动，应同时检查浅色和深色主题。
