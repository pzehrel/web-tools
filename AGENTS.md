# AGENTS.md

给 AI 编码代理的项目指南。

## 项目概述

纯前端实现的 Web 工具集合（浏览器应用 / Safari 网页应用）。所有工具在浏览器本地运行，不上传数据，没有后端。不做 Tauri 等桌面封装。

站点以 SSG 方式构建（每个路由预渲染出静态 HTML），部署到 Cloudflare Workers 静态资产。

## 技术栈

- **构建**：Vite 7（端口 1420，`strictPort`）+ `vite-react-ssg`（SSG 预渲染）
- **框架**：React 19 + TypeScript（strict，`tsc -b` 项目引用模式）+ react-router v8
- **样式**：Tailwind CSS v4（经 `@tailwindcss/postcss`）+ SCSS（`sass-embedded`）
- **UI 组件**：shadcn/ui（new-york 风格，`components.json` 已配置，`@` 别名指向 `src`）
- **图标**：lucide-react
- **Lint**：ESLint 9 + `@antfu/eslint-config`（v9，含 react 规则集）
- **包管理**：pnpm（见 `pnpm-workspace.yaml`）
- **部署**：Cloudflare Workers 静态资产（`wrangler.jsonc`），GitHub Actions 自动部署

## 常用命令

```bash
pnpm dev        # 开发服务器 http://localhost:1420（CSR 模式）
pnpm build      # tsc -b && SSG 构建（产出 dist/，含各路由预渲染 HTML）
pnpm preview    # 预览构建产物
pnpm lint       # ESLint 检查
pnpm lint:fix   # ESLint 自动修复
pnpm typecheck  # tsc -b 类型检查
pnpm release    # 发版：生成 CalVer tag（v2026.08.18 格式）并推送，触发生产部署
```

## 硬性规则

1. **不用 Prettier**，格式化一律交给 `pnpm lint:fix`。
2. **不新建 `.css` 文件**，样式全部写 `.scss`。Tailwind 入口是 `src/index.scss`。
   - 注意：`@tailwindcss/vite` 插件只处理 `.css` 文件，所以本项目用
     `@tailwindcss/postcss`（在 `vite.config.ts` 的 `css.postcss` 中配置），不要改回去。
   - 在 `.scss` 中引入 Tailwind 必须写带后缀的路径 `@import 'tailwindcss/index.css';`
     （让 sass 当作纯 CSS 导入透传，再由 PostCSS 阶段的 Tailwind 编译）。
3. **不写死颜色**（禁止 `bg-purple-500`、`#7c3aed` 这类）。所有颜色走 shadcn 语义令牌
   （`bg-primary`、`border-border`、`text-muted-foreground` 等），装饰色用 `bg-chart-1` ~ `bg-chart-5`。
   换肤只改 `src/index.scss` 里的 `:root` / `.dark` 色板。
4. **UI 风格遵循 `docs/DESIGN.md`**（新粗野主义：2px 描边、`shadow-hard-*` 硬阴影、
   悬停抬起/按下压实交互）。不要引入侧边栏 + 数据表格的后台管理系统布局。
5. **包管理用 pnpm**，不要用 npm/yarn。本机全局启用了 `trustPolicy: no-downgrade`，
   遇到 `[ERR_PNPM_TRUST_DOWNGRADE]` 时先核实是否为 provenance 误报
   （参考 `pnpm-workspace.yaml` 中现有排除项的注释），不要擅自放宽用户全局安全策略。
6. 构建脚本白名单在 `pnpm-workspace.yaml` 的 `allowBuilds` 中维护。
7. shadcn/ui 组件（`src/components/ui/`）允许同时导出组件和常量
   （已在 `eslint.config.ts` 中关闭该目录的 `react-refresh/only-export-components`）。
8. TypeScript 开了 `verbatimModuleSyntax`：类型导入必须用 `import type`。

## 部署（Cloudflare Workers + GitHub Actions）

### 架构

- `pnpm build` = `tsc -b` + `node scripts/ssg-build.mjs`（vite-react-ssg 预渲染所有路由到 `dist/`）。
  - 不用 vite-react-ssg 自带 CLI：其 yargs 命令在部分 Node 版本下异步 handler 是
    fire-and-forget，进程会静默退出不构建。`scripts/ssg-build.mjs` 直接 `await build()`。
- `wrangler.jsonc`：assets-only Worker（无 Worker 代码），`dist/` 直接作为静态资产；
  `html_handling: 'drop-trailing-slash'`（与 canonical 的无尾斜杠 URL 对齐）。
- 生产域名：`https://webtools.pzehrel.com`（Cloudflare Workers 自定义域名）
  （写在 `src/components/seo.tsx` 的 `SITE_URL`、`public/sitemap.xml`、`public/robots.txt`，
  换域名时三处一起改）。

### 触发策略（`.github/workflows/deploy.yml`）

| 触发          | 动作                       | 结果                         |
| ------------- | -------------------------- | ---------------------------- |
| PR            | `wrangler versions upload` | 一次性预览 URL，bot 评论回链 |
| push main     | `wrangler versions upload` | 预览，不碰生产               |
| push `v*` tag | `wrangler deploy`          | 生产部署                     |

- 每次部署前先跑 `pnpm lint && pnpm typecheck`。
- 首次部署有 `Ensure Worker exists` 步骤兜底（`versions upload` 不能用于不存在的 Worker）。
- 需要的 secrets：`CLOUDFLARE_API_TOKEN`（Workers Scripts: Edit）、`CLOUDFLARE_ACCOUNT_ID`。

### 发版

`pnpm release`（`scripts/release.mjs`）：工作区有未提交改动会拒绝执行；
生成 `vYYYY.MM.DD` tag（同日重复自动加 `.1` 后缀）并推送，触发生产部署。

### SSG 相关注意事项（改路由/入口前必读）

- **路由在 `src/main.tsx`**：数据路由对象 + `ViteReactSSG`。每个路由有显式 `id`，
  `customCreateRouter` 注入对应的 `hydrationData.loaderData`——这是修复
  「水合后页面出现两份内容」的关键（vite-react-ssg 给每个路由包了静态数据 loader，
  loaderData 为空会导致 React Router 认为未初始化、首渲走 HydrateFallback 与 SSR 不一致）。
  **新增路由必须同步加 id 和 ROUTE_IDS 数组**。
- **`vendor/react-router-dom/`**：兼容垫片（file: 依赖）。vite-react-ssg 按
  react-router v6 习惯引用 `react-router-dom`（含 `server.js` 子路径），本项目用 v8 单包，
  垫片转发到 `react-router`，不要删。
- **localStorage 内容必须用 `<ClientOnly>` 包裹**（历史记录、主题切换），
  否则服务端/客户端首渲不一致导致 hydration 失败。
- **SEO**：每页用 `src/components/seo.tsx` 的 `<Seo>` 组件写 title/description/OG/canonical；
  `index.html` 模板里不放静态 title/description（避免与 helmet 输出重复）。
- 主题防闪烁：`index.html` 有内联脚本在 React 挂载前挂 `.dark` class。

## 目录结构

```
src/
  main.tsx            # 入口：路由定义 + ViteReactSSG（含 hydrationData 注入）
  root-layout.tsx     # 全局布局（Outlet + ThemeToggle）
  App.tsx             # 首页（工具卡片网格）
  index.scss          # Tailwind 入口 + 主题令牌（唯一的全局样式文件）
  tools/index.ts      # 工具注册表（新增工具在这里登记）
  components/
    ui/               # shadcn/ui 组件（button、card 已按设计规范定制）
    tool-card.tsx     # 工具卡片
    seo.tsx           # 每页 <head> 管理（title/OG/canonical）
    theme-toggle.tsx  # 主题切换（跟随系统/浅色/深色）
  lib/
    utils.ts          # cn() 等工具函数
    theme.ts          # useTheme()：偏好存 localStorage，跟随系统联动
vendor/react-router-dom/  # vite-react-ssg 兼容垫片（勿删）
scripts/
  ssg-build.mjs       # SSG 构建入口（绕过 CLI 的 Node 兼容问题）
  release.mjs         # CalVer 发版脚本
docs/DESIGN.md        # 设计规范（改 UI 前必读）
public/               # 图标、manifest、sitemap.xml、robots.txt
wrangler.jsonc        # Workers 静态资产部署配置
.github/workflows/    # 部署 workflow
.husky/               # pre-commit：pnpm lint && pnpm typecheck
```

## 新增一个工具的流程

1. 在 `src/tools/index.ts` 的 `tools` 数组登记元信息（id、名称、描述、lucide 图标、`accentClass`）。
2. 在 `src/tools/` 下实现工具页面组件，页面顶部加 `<Seo>`。
3. 在 `src/main.tsx` 的路由表登记 `/tools/:id`：**路由加显式 `id` 并同步 `ROUTE_IDS`**，
   否则水合会出问题。
4. 把 `status` 从 `planned` 改为 `ready`。
5. `public/sitemap.xml` 加新路由的 URL。
6. UI 遵循 `docs/DESIGN.md`；优先复用 `Button` / `Card`。

## 验证

改动完成后必须跑通：`pnpm lint`、`pnpm typecheck` 和 `pnpm build`。
涉及视觉改动时建议用 playwright-cli 截图确认亮/暗两套主题都正常。
SSG/路由相关改动建议额外验证：构建后用 `pnpm preview` 打开页面，
确认 `#root` 下只有一份内容（水合正常）。
