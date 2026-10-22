# Mermaid 工作流原型观察记录

日期：2026-10-22（Asia/Shanghai）。决策：[Mermaid 编辑器：用复杂图原型验证画布与代码工作流](https://github.com/pzehrel/web-tools/issues/21)。源码分支：`prototype/mermaid-workflow`。**用户已否定首批结构方案，要求全屏画布与 HUD。修改后的产物仍待用户验收，决策票保持开放。**

## 产物

在原型工作树运行 `pnpm prototype:mermaid`，打开 `http://localhost:1421/tools/mermaid-prototype`。当前版本采用全屏画布、悬浮 HUD 和按需展开的代码/属性/帮助浮层。旧的 `variant=A/B/C` 链接现在也显示此版本。[运行说明与限制](../../apps/web/src/tools/mermaid-prototype/README.zh-CN.md)。

默认样例有 11 个图对象，包含三个具有嵌套关系的分组容器，以及 12 条连线。它覆盖条件、回路、自连边、平行边、跨组连线、分组之间的连线和普通注释。浏览器实际运行 React Flow 12.12.0、elkjs 0.12.0 与 Mermaid 12.2.0。

## 框选可见性修复与画布库边界

用户反馈多选框内的内容不可见，并提出使用专门的图编辑库，在其基础上兼容 Mermaid 导入导出。原型的视口、矩形框选和连接端点已经交给 React Flow；已接受的 React Flow＋ELK＋Mermaid 路线保持不变。复用编辑器并增加 Mermaid 兼容层符合这条边界，文档层仍负责导入原稿、错误草稿和代码/画布统一历史。本次反馈尚未决定迁移到其他引擎。

临时 Playwright 脚本拖动矩形框住 Browser 和 App。修复前反复失败，报错为 `Selection fill hides enclosed content: alpha=1`；截图显示实色矩形遮住了两个已选节点。原因是主题覆盖将不透明的 `secondary` 用作 React Flow 选框背景。此次仅修改该变量：语义主色以 8% 不透明度填充，保留底层内容可见。同一脚本在亮/暗主题均通过，采样 alpha 为 `0.0784313725490196`，两个节点 ID 均被选中，11 个图对象均保留。松开指针后多选范围框仍在，撤销/重做计数仍为零。已查看截图，没有添加持久的原型测试套件。

- [修复前：实色选框](evidence/selection-before-light.png)
- [修复后：浅色选框](evidence/selection-light.png)
- [修复后：暗色选框](evidence/selection-dark.png)

2026-10-22 核对的一手资料：[React Flow 视口控件](https://reactflow.dev/learn/concepts/the-viewport) 说明拖动框选与视图控件；[React Flow 主题](https://reactflow.dev/learn/customization/theming) 说明选框颜色变量和半透明默认值。[AntV X6](https://x6.antv.antgroup.com/en) 是另一种图编辑引擎，提供框选等编辑扩展；当前路线验证失败时可考虑它，尚未选作替代。这些库不能证明任意 Mermaid 源码往返保真。

## 视觉风格对齐修改

用户反馈图标太粗，整体风格与当前站点不搭。本次以当前 `docs/DESIGN.md` 和帧动画/九宫格 HUD 样式为参照。浏览器检查发现，之前的工具图标实际为 24 px，没有达到共享按钮预期的尺寸。局部 HUD 规则现采用 14 px 图标、1.5 描边宽度（起止形状为 17×11 px）、28 px 桌面按钮、11 px 控件文字、40 px 顶部工具条、6 px 面板圆角，并沿用现有语义半透明底色与模糊处理。手机形状按钮保留 32 px 点击区域。React Flow 的实心缩放/适应图标已替换为相同的 Lucide 线框控件，视图操作行为保持有效。

Chromium 检查确认图标的计算尺寸与描边、缩放/适应功能、打开代码时全屏画布尺寸不变，以及手机工具条位于 390 px 视口内。已查看桌面亮/暗主题、代码浮层和手机暗色截图。Lint、typecheck 与 build 通过，lint 仍有相同的 21 条警告。此风格修改仍待用户评审。

- [调整后的 HUD：桌面浅色](evidence/hud-refined-desktop-light.png)
- [调整后的 HUD：桌面暗色](evidence/hud-refined-desktop-dark.png)
- [调整后的代码浮层：桌面暗色](evidence/hud-refined-code-dark.png)
- [调整后的 HUD：手机宽度暗色](evidence/hud-refined-mobile-dark.png)

## 全屏 HUD 修改版

用户反馈：“原型不太行，要全屏画布+hud的模式。”之前的 A/B/C 结构方案被否定，不能视为已接受的基线。画布现在占满视口；文档、视图、历史与形状控件悬浮在边缘。代码与属性覆盖在画布上，不改变画布尺寸。仅在本原型挂载期间隐藏共享站点页头；HUD 保留返回、导入与主题操作。

修改版的浏览器操作确认：

- Chromium 1440×900：画布矩形精确为 `(0, 0, 1440, 900)`。展开代码 HUD 后，该矩形和数据库节点的屏幕矩形均未变化；Escape 关闭 HUD。
- 拖动数据库节点保留源文本；一次撤销恢复节点精确的原样式/几何信息。平移工具改变视图变换，撤销/重做计数不变。通过 HUD 添加矩形、再在属性中改名，均会更新图。
- 亮/暗主题控件和代码复制入口仍可使用。预览中显示 Mermaid SVG，并可同时展开代码浮层。
- Playwright WebKit 390×844：画布矩形精确为 `(0, 0, 390, 844)`。代码 HUD 为 `(10, 108, 370, 624)`，文档不溢出，展开时视图变换不变；11 个图对象均保留。
- 错误代码保留在 HUD 内，保留的预览标注来自上一次有效源码，撤销恢复原源码和可视化编辑模式。
- WebKit 的原生按钮外观最初遮盖了暗色 HUD 配色；局部 `appearance: none` 已修正。启动时有一条开发警告称 React Flow 样式未加载；加载后的画布面板计算值符合要求的 `z-index: 1`，图形正常渲染。此观察不能证明原生 Safari/设备已经验收。

`pnpm lint`、`pnpm typecheck` 和 `pnpm build` 通过。Lint 有 21 条警告：20 条来自原有代码，1 条针对原型插入 Mermaid SVG。本次修改没有新增原型测试文件。

## 初版浏览器观察

以下是通过脚本操作的人工浏览器检查，不是新增的自动测试文件或正式验收套件。

| 场景 | 观察结果 |
| --- | --- |
| 初始图 | 11 个对象与 12 条连线均显示；三种布局方案均成功加载。 |
| 首次画布改名 | 显示统一排版对话框；接受后生成有效代码、修改文字并保留注释。 |
| 拖动与撤销 | 拖动最外层数据库节点改变几何信息，但源文本完全不变；一次撤销恢复精确的原坐标。 |
| 拖线连接 | 从任务节点拖向数据库的圆点，新增第三条平行边；总连线数变为 13，普通注释仍保留。 |
| 不支持语法 | 有效的 `classDef` 输入进入代码与预览模式，输入保留，画布编辑关闭。 |
| 错误源码 | 未闭合分组保留完整草稿，显示 Mermaid 解析错误，保留的预览明确标注来自上一次有效代码。 |
| 错误输入前后的撤销与重做 | 撤销恢复先前源码；重做保留完全相同的错误草稿。连续输入可能合并为一步历史。 |
| 移除不支持语法 | 恢复可视化编辑；逐对象比较的几何值未变化。对象键顺序变化不等于布局变化。 |
| 快速连续修改 | Job 的可见文字对应最终输入，没有被较早文本覆盖。这是有界检查，不证明所有异步竞争都已解决。 |
| 移入分组与撤销 | 明确将 App 移入 CORE 后，12 条连线和注释保留；撤销后父分组恢复为 CLIENT。 |
| 解除分组提示 | CLIENT 有以分组为端点的连线。对话框提供取消，或保留成员并删除端点连线；此方案仍需用户认可。 |
| 注入转换故障 | 在候选代码转换后、提交前实际注入故障，源码、图与历史均未修改。 |
| WebKit | Playwright WebKit 成功加载图并生成 Mermaid SVG；这不能证明原生 Safari 网页应用的行为。 |
| 手机宽度 WebKit | 390×844 下，暗色布局有 11 个画布对象，文档级别没有横向溢出。这是视口证据，不是物理触屏设备检查。 |

## 截图

当前 HUD 修改版：

- [全屏画布：桌面浅色](evidence/hud-desktop-light.png)
- [代码浮层：桌面浅色](evidence/hud-code-desktop-light.png)
- [全屏画布：桌面暗色](evidence/hud-desktop-dark.png)
- [预览与代码：桌面暗色](evidence/hud-preview-desktop-dark.png)
- [全屏画布：手机宽度 WebKit 暗色](evidence/hud-webkit-mobile-dark.png)
- [代码浮层：手机宽度 WebKit 暗色](evidence/hud-code-webkit-mobile-dark.png)

已否定的初版结构，作为历史保留：


- [A：画布优先](evidence/variant-A-desktop-light.png)
- [B：代码并排](evidence/variant-B-desktop-light.png)
- [C：引导工作台](evidence/variant-C-desktop-light.png)
- [C：暗色主题](evidence/variant-C-desktop-dark.png)
- [WebKit：手机宽度暗色主题](evidence/webkit-mobile-dark.png)

## 明确限制与待决问题

- 源码导入使用锁定版本的内部 FlowDB，不是稳定的公开 AST。语义对比和普通注释保留只在当前样例得到演示，尚未证明任意 Mermaid 输入、重复声明、全部样式或所有注释位置的行为。
- ELK 递归布局同层容器，并投影跨组连线。画布路径是简化曲线，没有避障能力。本产物不能证明完整已接受范围的路由质量。
- 布局引擎目前运行在主线程。显示的耗时只是一次本地布局观察，不是图规模预算或延迟保证。
- 初次生产构建生成了约 2.31 MB 的编辑器分块（gzip 约 670 kB）和单独约 1.48 MB 的 ELK 分块（gzip 约 454 kB），此外还有其他资源。这是单个输出的观察，不是汇总的冷加载预算或优化后的交付设计。
- 原生 Safari 独立应用、真实 iOS/触屏、物理输入法组合、完整键盘可访问性/焦点约束、持续大图操作，以及穷举的竞争/安全检查仍未验证。
- 没有实现工程持久化或图片导出。刷新或加载其他样例会丢弃内存修改；仅切换视图会保留这些修改。

人工评审需要判断修改后的全屏 HUD 结构、代码与画布的区分是否清楚，并反馈分组端点连线删除和注释关联方案。发现问题时可能需要重新评估技术路线；原型不授权静默削减已接受范围。

[English](prototype-observations.md)
