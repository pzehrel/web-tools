# AGENTS.md

给 AI 编码代理的项目指南。

## 项目概述

纯前端实现的 Web 工具集合（浏览器应用 / Safari 网页应用）。所有工具在浏览器本地运行，不上传数据，没有后端。不做 Tauri 等桌面封装。

## 技术栈

- **构建**：Vite 7（端口 1420，`strictPort`）
- **框架**：React 19 + TypeScript（strict，`tsc -b` 项目引用模式）
- **样式**：Tailwind CSS v4（经 `@tailwindcss/postcss`）+ SCSS（`sass-embedded`）
- **UI 组件**：shadcn/ui（new-york 风格，`components.json` 已配置，`@` 别名指向 `src`）
- **图标**：lucide-react
- **Lint**：ESLint 9 + `@antfu/eslint-config`（v9，含 react 规则集）
- **包管理**：pnpm（见 `pnpm-workspace.yaml`）

## 常用命令

```bash
pnpm dev       # 开发服务器 http://localhost:1420
pnpm build     # tsc -b && vite build
pnpm preview   # 预览构建产物
pnpm lint      # ESLint 检查
pnpm lint:fix  # ESLint 自动修复
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

## 目录结构

```
src/
  main.tsx            # 入口
  App.tsx             # 首页（工具卡片网格）
  index.scss          # Tailwind 入口 + 主题令牌（唯一的全局样式文件）
  tools/index.ts      # 工具注册表（新增工具在这里登记）
  components/
    ui/               # shadcn/ui 组件（button、card 已按设计规范定制）
    tool-card.tsx     # 工具卡片
  lib/utils.ts        # cn() 等工具函数
docs/DESIGN.md        # 设计规范（改 UI 前必读）
public/               # 图标、manifest.webmanifest（Safari 加 Dock 用）
```

## 新增一个工具的流程

1. 在 `src/tools/index.ts` 的 `tools` 数组登记元信息（id、名称、描述、lucide 图标、`accentClass`）。
2. 在 `src/tools/` 下实现工具页面组件（目前尚无路由，接入路由时用 `id` 作路径 `/tools/:id`）。
3. 把 `status` 从 `planned` 改为 `ready`。
4. UI 遵循 `docs/DESIGN.md`；优先复用 `Button` / `Card`。

## 验证

改动完成后必须跑通：`pnpm lint` 和 `pnpm build`。
涉及视觉改动时建议用 playwright-cli 截图确认亮/暗两套主题都正常。
