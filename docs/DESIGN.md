# Web Tools 设计规范

## 风格定位：新粗野主义（Neo-Brutalism）

本项目是一套「打开即用」的浏览器小工具集合。视觉上刻意与后台管理系统风格保持距离：
不做侧边栏、不做数据表格、不做灰扑扑的密集表单，而是像一盒摆在桌上的实体工具——
**粗描边、硬阴影、大标题、高饱和点缀色**，带一点玩具感和印刷感。

三个关键词：

- **扎实**：所有元素有明确的「边界」和「重量」（2px 描边 + 无模糊硬阴影）
- **直白**：层级靠字号和色块区分，不依赖灰度渐变和投影层级
- **顽皮**：徽章可以轻微旋转，按钮按下去有「压实」的物理反馈

## 换肤机制（必须遵守）

所有颜色一律走 shadcn/ui 语义令牌，**禁止在组件里写死颜色值**（如 `bg-purple-500`、`#7c3aed`）。

| 场景                   | 令牌                                     |
| ---------------------- | ---------------------------------------- |
| 页面底色 / 正文        | `bg-background` / `text-foreground`      |
| 主行动色（按钮、强调） | `bg-primary` / `text-primary-foreground` |
| 点缀色（徽章、贴纸）   | `bg-secondary`、`bg-accent`              |
| 卡片底色               | `bg-card`                                |
| 描边 / 硬阴影          | `border-border`（联动 `--shadow-color`） |
| 弱化文本               | `text-muted-foreground`                  |
| 装饰性色块（如图标底） | `bg-chart-1` ~ `bg-chart-5`              |

换肤 = 只改 `src/index.scss` 中 `:root` / `.dark` 两张色板，组件零改动。

## 风格专属令牌

在标准令牌之外，主题定义了硬阴影工具类（`@theme inline`）：

```
shadow-hard-xs  2px 2px 0 0   徽章、logo 印章、小按钮
shadow-hard-sm  3px 3px 0 0   卡片默认态、Hero 高亮块
shadow-hard     5px 5px 0 0   卡片悬停态
shadow-hard-lg  8px 8px 0 0   弹窗等需要「浮起」的层级
```

阴影颜色跟随 `--shadow-color`（亮色=墨黑，暗色=纸白），换肤时同步调整。

圆角基准 `--radius: 0.375rem`（小圆角），通过 `rounded-md` 等标准类使用。

## 交互语言：抬起与压实

可交互元素的统一动效（已内置于 `Button` 与 `ToolCard`，新组件应复用）：

- **悬停 = 抬起**：`hover:-translate-x-0.5 hover:-translate-y-0.5`，阴影加大一级
- **按下 = 压实**：`active:translate-x-0.5 active:translate-y-0.5`，阴影收回或消失
- 过渡统一 `transition-all`，时长用默认（150ms），不加花哨缓动

## 排版

- 标题：`font-black`（900）+ `tracking-tight`，Hero 可用 `text-4xl/5xl`
- 卡片标题、按钮文字：`font-bold`
- 正文/辅助：`text-sm text-muted-foreground`
- 字标、徽章中的短词可以 `-rotate-2` 等轻微倾斜制造手工感，**一处页面最多一两个**

## 布局规则

- 页面容器：`mx-auto max-w-5xl px-4`（内容集中，不做满宽后台式布局）
- 工具网格：`grid sm:grid-cols-2 lg:grid-cols-3 gap-5`
- 分隔用 `border-t-2 border-border` 的实线，不用 1px 灰线
- 不做侧边栏导航；工具页之间通过首页和面包屑往返

## 表单排版

参数面板的字段统一「标签在上、控件在下」，不做左标签右控件的密排行：

- 字段标签：`mb-1.5 text-xs font-bold text-muted-foreground`（弱化小字，不做主色大标题）
- 单选 / 枚举：用描边分段控件（`OptionGroup` 模式：`role="radiogroup"` + `role="radio"`，
  选中项主色填充），默认占满整行宽度
- 数字输入：等宽字体居中 + `border-2` + 聚焦 `ring-[3px] ring-ring/50`；
  成组的四边值（上/右/下/左）用 `grid grid-cols-4` 平铺，输入在上、方位小字在下
- 勾选：`BrutalCheckbox` 模式（sr-only 原生 input + 2px 描边方块 + 硬阴影抬起/压实）
- 短行内组合（如「外扩 + 填充」）：底边对齐 `items-end`，较矮的控件包一层与输入框等高的
  `items-center` 容器，保证视觉中心对齐

## 画布舞台（图像类工具）

涉及图片查看 / 编辑的工具（点九图、帧动画）共用一套舞台约定，手势实现收在
`src/lib/stage.ts`（`useStageZoom` / `useStagePan`），新工具直接复用：

- **缩放**：滚轮 / 触控板捏合 / 触屏双指，连续缩放 25% ~ 800%（指数曲线，手感均匀）。
  视图缩放只影响查看，永远不写进导出参数；因此**不设缩放挡位选择器**
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
- **底纹**：棋盘格用 conic-gradient 四象限拼格；颜色走语义令牌（如 `var(--muted)`），
  允许用户自定义时提供「恢复跟随主题」入口
- 实现细节：React 的 `onWheel` 是 passive 监听，缩放必须挂原生 `wheel` 监听
  （`{ passive: false }`）；舞台配 `touch-none`，触屏双指才不会被浏览器页面缩放接管

## Do / Don't

**Do**

- 新组件优先复用 `Button` / `Card` 的描边 + 阴影组合
- 装饰色用 `chart-*` 令牌，保证主题联动
- 暗色模式必须同样成立（描边和阴影会自动反白）

**Don't**

- 不用柔和弥散阴影（`shadow-lg`、`drop-shadow` 等默认柔影一律不用）
- 不用 1px 边框，描边统一 `border-2`
- 不用大面积渐变、玻璃拟态、模糊背景
- 不把页面做成「左侧菜单 + 右侧表格」的后台范式
