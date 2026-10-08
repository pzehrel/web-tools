# Web Tools 设计规范

## 风格定位：瑞士极简 / 编辑风（Swiss Minimal）

本项目是一套「打开即用」的浏览器小工具集合。视觉上刻意与后台管理系统、
与「一眼 AI」的模板站保持距离：**没有卡片盒子、没有阴影层级、没有渐变**，
层级靠分割线、留白与字阶表达——像一份排印考究的工具目录。

三个关键词：

- **直白**：黑白灰 + 单一 teal 强调色，内容即界面
- **分割**：板块用 1px 发丝线分割，不用卡片底色差、不用阴影浮起
- **精密**：等宽字体做标题与数值（JetBrains Mono），IBM Plex Sans 做正文

候选风格检索依据见 `design-system/webtools/MASTER.md`（ui-ux-pro-max 数据库：
`minimalism-and-swiss-style` + `Developer Mono` 字体配对 + `portfolio-grid` 布局）。

## 换肤机制（必须遵守）

所有颜色一律走 shadcn/ui 语义令牌，**禁止在组件里写死颜色值**（如 `bg-purple-500`、`#7c3aed`）。

| 场景                   | 令牌                                     |
| ---------------------- | ---------------------------------------- |
| 页面底色 / 正文        | `bg-background` / `text-foreground`      |
| 主行动色（按钮、强调） | `bg-primary` / `text-primary-foreground` |
| 悬停洗刷底             | `bg-secondary`、`bg-accent`              |
| 板块底色（同背景）     | `bg-card`                                |
| 分割线 / 边框          | `border-border`（1px 发丝线）            |
| 弱化文本               | `text-muted-foreground`                  |
| 装饰性色块（图表等）   | `bg-chart-1` ~ `bg-chart-5`              |

换肤 = 只改 `src/index.scss` 中 `:root` / `.dark` 两张色板，组件零改动。

## 风格专属令牌

- 圆角基准 `--radius: 0`（直角）；如需过渡可用 `calc(var(--radius) + 2px)` 以内的折中。
- **无阴影**：旧粗野主义的 `shadow-hard-*` 令牌已随工具页清理一并删除，
  **任何代码一律不写阴影**。
- 唯一彩色：`--ring`（teal 焦点环）。除 chart-* 装饰色与 destructive 外，
  界面不允许出现第三种色相。

## 交互语言：颜色变化

可交互元素的统一动效（已内置于 `Button` 与 `ToolRow`，新组件应复用）：

- **悬停 = 变色**：填充加深（`hover:bg-primary/85`）或边框加重（`hover:border-foreground`），
  或浅灰洗刷（`hover:bg-muted/60`）
- **按下**：无位移、无 scale、无阴影变化，只保持颜色态
- 过渡统一 `transition-colors`，时长 150ms
- 禁止 `hover:scale-105`、`translate-y` 抬升等位移反馈（layout-shifting hover）

## 排版

- 字体：标题/数值/代码用 `font-mono`（JetBrains Mono），正文用 `font-sans`（IBM Plex Sans），
  已在 `index.scss` 的 `@layer base` 中全局设定
- 标题：`font-semibold`（600）+ `tracking-tight`，Hero 可用 `text-4xl/5xl`；不用 `font-black`
- 正文/辅助：`text-sm text-muted-foreground`
- 行宽：长正文 `max-w-prose`（65ch）
- 数字对齐：编号、百分比等用 `tabular-nums`
- 不用渐变文字、不用字距拉开的全大写 eyebrow

## 布局规则

- **去卡片化**：板块分割用 `border-b border-border` 发丝线 + 留白，
  不用「圆角盒子 + 底色差 + 阴影」的卡片范式
- 列表条目用整行布局（`grid` + `border-b`），行内悬停洗刷，不做一格格卡片
- 页面容器：`mx-auto max-w-5xl px-4`（内容集中，不做满宽后台式布局）
- 分隔一律 `border border-border`；区块顶部可以用 2px 实线做主分割（印刷感），
  但组件内部边框保持 1px
- 不做侧边栏导航；工具页之间通过首页和面包屑往返

## 表单排版

参数面板的字段统一「标签在上、控件在下」，不做左标签右控件的密排行：

- 字段标签：`mb-1.5 text-xs font-medium text-muted-foreground`
- 单选 / 枚举：用分段控件（`role="radiogroup"` + `role="radio"`，
  选中项 `bg-primary` 填充），默认占满整行宽度
- 数字输入：等宽字体 + 1px 边框 + 聚焦 teal 焦点环；
  成组的四边值（上/右/下/左）用 `grid grid-cols-4` 平铺，输入在上、方位小字在下
- 勾选：原生 input（可 sr-only）+ 1px 描边方块，选中用 `bg-primary` 填充 + 对勾
- 短行内组合：底边对齐 `items-end`，保证视觉中心对齐

## 画布舞台（图像类工具）

涉及图片查看 / 编辑的工具（点九图、帧动画）共用一套舞台约定，手势实现收在
`src/lib/stage.ts`（`useStageZoom` / `useStagePan`），新工具直接复用：

- **缩放**：滚轮 / 触控板捏合 / 触屏双指，连续缩放 1% ~ 800%（指数曲线，手感均匀）。
  视图缩放只影响查看，永远不写进导出参数；因此**不设缩放挡位选择器**
  - 画布同时存在多个内容时，以所有内容的联合矩形完整适配舞台作为 100%，用户缩放在该基础比例上继续计算。
  - 缩放手势发生时，画布左下角显示当前百分比；停止缩放约 1.2 秒后淡出。
- **平移**：按住拖动空白 / 画面区域，内容层做 `transform: translate` 偏移，
  任何缩放级别都可拖（scroll 式平移在内容不溢出时滚动范围为 0，拖了没反应，不用）。
  平移或缩放偏离默认时，舞台右上角出现「重置视图」按钮（居中 + 恢复默认缩放）。光标 `cursor-grab` / `cursor-grabbing`。
  按下落在切线、拖拽手柄等其他交互元素上时不启动平移
  （利用事件冒泡顺序由内层 guard 拦截）；落在按钮等可点元素上也不启动
  （否则 pointer capture 会吞掉 click）
- **舞台尺寸**：高度必须由外层确定（固定 `h-*` 或绝对定位 `inset-0`），内容 `m-auto`
  居中、超出裁剪（`overflow-hidden`，靠拖拽平移查看）。两个坑：flex 链路的
  max-content 计算会把内容尺寸传播到上层（`min-h-0` 也拦不住），所以舞台宁可
  `absolute inset-0` 脱离文档流；若用 `overflow: auto` 方案，注意它只在有确定
  高度上限时才裁剪，`min-h-*` + 高度 auto 会被放大后的内容撑高
- **悬浮操作**：更换 / 添加图片等按钮用 `size="icon-sm"` 浮在舞台**右上角**，
  挂在滚动容器外面的相对定位层（否则随内容一起滚走）
- **查看辅助**：画布有内容时，左上角统一显示「边界」与「画布背景」图标按钮，
  复用 `StageViewControls` / `useStageViewSettings`；空画布不显示。边界只影响查看，
  背景面板提供棋盘格 / 纯色与 6 套主题配色，不写入导出结果
- **底纹**：棋盘格用 conic-gradient 四象限拼格；颜色走语义令牌（如 `var(--muted)`），
  允许用户自定义时提供「恢复跟随主题」入口
- 实现细节：React 的 `onWheel` 是 passive 监听，缩放必须挂原生 `wheel` 监听
  （`{ passive: false }`）；舞台配 `touch-none`，触屏双指才不会被浏览器页面缩放接管

## Do / Don't

**Do**

- 板块分割用发丝线 + 留白；列表用整行条目
- 新组件优先复用 `Button`（平面变色交互）
- 装饰色用 `chart-*` 令牌，保证主题联动
- 暗色模式必须同样成立（色板自动反白）

**Don't**

- 不用卡片盒子做板块分割（圆角 + 底色差 + 阴影的组合是 AI slop 标志）
- 不用任何阴影（`shadow-*` 柔影与遗留 `shadow-hard-*` 均不新增引用）
- 不用紫色/靛蓝主色、渐变、玻璃拟态、发光装饰、emoji 图标
- 不用位移类悬停反馈（`scale` / `translate` 抬升）
- 不把页面做成「左侧菜单 + 右侧表格」的后台范式

## 工具页分栏模式（已全站完成）

所有工具页已按同一模式去卡片化（`Card` 组件已删除）：

- 页面顶栏带 `border-b border-border` 底边发丝线，标题 `font-mono text-lg font-semibold`
- 板块用 `<section>` + mono 小字标题行
  （`<h2 className="font-mono text-sm font-semibold tracking-tight">`，
  操作按钮内联右侧，描述用 `text-xs text-muted-foreground`）
- 多列工作台：列间 `lg:border-l lg:border-border lg:pl-6` 垂直发丝线分隔；
  同列上下板块用 `border-t pt-4` 水平线分隔，不做卡片盒
- 画布舞台等功能性容器保留 1px 边框，内部留白 `p-3` 左右即可
