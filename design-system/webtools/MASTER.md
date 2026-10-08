# Design System Master File — Swiss Minimal (候选风格稿)

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** WebTools
**Generated:** 2026-10-08（基于 ui-ux-pro-max 数据库检索，人工修正）
**Category:** Design System/Component Library

> **来源与修正说明**：由 `ui-ux-pro-max` skill 检索生成
> （style: `minimalism-and-swiss-style`；typography: `Developer Mono` 配对；
> layout: `portfolio-grid` / `bento-grid-showcase`）。
> 生成器原始输出的靛蓝色板（#4F46E5）、四档阴影、8–16px 圆角、玻璃拟态弹窗、
> FAQ Landing 模式均与其自身瑞士风数据（黑白 + 单一强调色、radius 0、无阴影）
> 冲突，已按下述原则修正。本项目现行规范见 `docs/DESIGN.md`（新粗野主义），
> 本文件为**候选替换稿**，二者取其一，不混用。

---

## Global Rules

### Color Palette

黑白灰为主 + 单一 teal 强调色（60-30-10）。禁止紫色/靛蓝系、禁止渐变。

**Light**

| Role             | Hex                           | CSS Variable               |
| ---------------- | ----------------------------- | -------------------------- |
| Primary          | `#0F172A`（近黑）             | `--color-primary`          |
| On Primary       | `#FFFFFF`                     | `--color-on-primary`       |
| Background       | `#FFFFFF`                     | `--color-background`       |
| Foreground       | `#0F172A`                     | `--color-foreground`       |
| Card             | `#FFFFFF`                     | `--color-card`             |
| Card Foreground  | `#0F172A`                     | `--color-card-foreground`  |
| Muted            | `#F1F5F9`                     | `--color-muted`            |
| Muted Foreground | `#475569`                     | `--color-muted-foreground` |
| Border           | `#E2E8F0`                     | `--color-border`           |
| Accent/CTA/Ring  | `#0D9488`（teal，唯一强调色） | `--color-accent`           |
| On Accent        | `#FFFFFF`                     | `--color-on-accent`        |
| Destructive      | `#DC2626`                     | `--color-destructive`      |
| On Destructive   | `#FFFFFF`                     | `--color-on-destructive`   |

**Dark**（Swiss 数据支持双模式）

| Role              | Hex                                  |
| ----------------- | ------------------------------------ |
| Background / Card | `#0F172A`                            |
| Foreground        | `#F8FAFC`                            |
| Muted             | `#1E293B`                            |
| Muted Foreground  | `#94A3B8`                            |
| Border            | `#334155`                            |
| Accent            | `#2DD4BF`（dark 模式提亮以保对比度） |

落地到本项目时仍写入 `apps/web/src/index.scss` 的 `:root` / `.dark` 语义令牌，
组件内不出现裸 hex。

### Typography

- **Heading Font:** JetBrains Mono（`font-family: var(--font-mono)`）
- **Body Font:** IBM Plex Sans（`var(--font-sans)`）
- **Mood:** code, developer, technical, precise, functional
- **Google Fonts:** [IBM Plex Sans + JetBrains Mono](https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap)
- 字重最多 3–4 档；标题 `leading-tight`，正文 `leading-relaxed`、行宽 ≤ 65ch。
  等宽字体只用于标题/代码/数值，长正文用 IBM Plex Sans。

### Spacing Variables

| Token         | Value             | Usage                     |
| ------------- | ----------------- | ------------------------- |
| `--space-xs`  | `4px` / `0.25rem` | Tight gaps                |
| `--space-sm`  | `8px` / `0.5rem`  | Icon gaps, inline spacing |
| `--space-md`  | `16px` / `1rem`   | Standard padding          |
| `--space-lg`  | `24px` / `1.5rem` | Section padding           |
| `--space-xl`  | `32px` / `2rem`   | Large gaps                |
| `--space-2xl` | `48px` / `3rem`   | Section margins           |
| `--space-3xl` | `64px` / `4rem`   | Hero padding              |

### Elevation & Radius（瑞士风核心）

- `--shadow: none`。层级靠边框（1px hairline）与留白表达，不靠阴影。
- `--border-radius: 0`（允许 2px 折中）。
- 无渐变、无 glow、无 aurora/blob、无玻璃拟态。

---

## Component Specs

### Buttons

```scss
/* Primary：黑底白字，唯一彩色 CTA 用 accent */
.btn-primary {
  background: var(--color-primary);
  color: var(--color-on-primary);
  padding: 8px 16px;
  border-radius: 0;
  font-weight: 600;
  transition: background-color 150ms ease, color 150ms ease;
  cursor: pointer;
}
.btn-primary:hover { background: var(--color-accent); color: var(--color-on-accent); }

/* Secondary：透明底 + 1px 边框 */
.btn-secondary {
  background: transparent;
  color: var(--color-foreground);
  border: 1px solid var(--color-border);
  padding: 8px 16px;
  border-radius: 0;
  font-weight: 500;
  transition: border-color 150ms ease;
}
.btn-secondary:hover { border-color: var(--color-foreground); }
```

### Cards（工具卡片）

```scss
.card {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 0;
  padding: 24px;
  box-shadow: none;
  transition: border-color 200ms ease;
  cursor: pointer;
}
.card:hover { border-color: var(--color-accent); }
/* 无位移、无 scale、无阴影抬升——只用边框色变化 */
```

### Inputs

```scss
.input {
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 0;
  font-size: 16px;
  background: var(--color-background);
  color: var(--color-foreground);
  transition: border-color 150ms ease;
}
.input:focus-visible {
  border-color: var(--color-accent);
  outline: 2px solid var(--color-accent);
  outline-offset: 1px; /* 焦点环必须可见，不用 box-shadow 模拟 */
}
```

### Modals

```scss
.modal-overlay { background: rgb(15 23 42 / 0.4); } /* 无 backdrop-blur */
.modal {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 0;
  padding: 32px;
  box-shadow: none;
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Minimalism & Swiss Style

**Keywords:** Clean, simple, spacious, functional, white space, high contrast, geometric, sans-serif, grid-based, essential

**Best For:** Enterprise apps, dashboards, documentation sites, SaaS platforms, professional tools

**Key Effects:** Subtle hover (200-250ms), smooth transitions, sharp shadows if any, clear type hierarchy, fast loading

### Page Pattern（工具站适配）

**Pattern Name:** Tool Grid（portfolio-grid 变体）

- **Section Order:**
  1. 紧凑 Hero：站名 + 一句话价值主张（本地运行 / 不上传数据）+ 搜索框
  2. 工具卡片网格（12–16 列网格内排布，卡片即内容，无装饰插画）
  3. 极简 Footer（只放真实链接）
- **每个区块一个主导元素**：Hero 之外不重复大标题；每区一个主操作。
- 网格卡片允许尺寸差异化（常用工具占大格），避免完全等重的 N 连卡。

---

## Anti-Patterns (Do NOT Use)

- ❌ **紫色/靛蓝主色**（#4F46E5 / #6366F1 / #8B5CF6 系）——AI slop 标志色
- ❌ **渐变**（文字/按钮/边框/背景，一律不用）
- ❌ **阴影层级、圆角>2px、玻璃拟态、glow、blob 装饰**
- ❌ **Emojis as icons** — 用 SVG 图标（本项目统一 lucide-react）
- ❌ **Layout-shifting hovers** — 禁 `hover:scale-105`、translateY 位移
- ❌ **Low contrast text** — 正文对比度 ≥ 4.5:1（亮暗两套都测）
- ❌ **Instant state changes** — 状态切换一律 150–250ms 过渡
- ❌ **Invisible focus states** — 键盘焦点环必须可见
- ❌ **全站单一 Inter** — 已选 JetBrains Mono + IBM Plex Sans，不回退

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use lucide-react instead)
- [ ] All icons from consistent icon set, 单色，尺寸 16–24px
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-250ms), color/border only
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
- [ ] 换 logo 成竞品没人发现区别？→ 是则 FAIL，重新设计
