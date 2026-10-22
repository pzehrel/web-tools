# Mermaid 工作流原型

这是 [Mermaid 编辑器：用复杂图原型验证画布与代码工作流](https://github.com/pzehrel/web-tools/issues/21) 的可丢弃、仅使用内存的 UI 原型。它验证画布建图、源码编辑、独立几何信息和统一撤销历史能否组成易于理解的工作流。它不是正式工具，也不是完整的 Mermaid 解析器。

## 运行

在本原型工作树中运行 `pnpm prototype:mermaid`，打开[原型页面](http://localhost:1421/tools/mermaid-prototype?variant=B)。依赖记录在工作树的锁文件中；新检出目录应先执行 `pnpm install --frozen-lockfile`。

三种结构方案共用一份内存文档：`?variant=A` 以画布优先、代码在下方；`?variant=B` 将画布与代码并排；`?variant=C` 将引导场景和命令放在工作区旁。底部切换条在开发模式显示。切换布局会保留文档；刷新、导入、选择其他示例或重置场景会开始新会话，丢弃之前的内存修改。

## 体验

1. 按四个引导场景体验：正常往返、错误与不支持语法、分组与注释、布局与转换失败。
2. 拖动节点、拖动小圆点连线、双击文字，或使用选中对象的文字输入框。Shift/Meta/Control 支持多选。改变归属需要使用明确的分组选择控件。
3. 对比编辑画布与 Mermaid 预览，再使用撤销/重做。查看导入原稿和文档状态面板，了解发生了什么变化。

解除分组对话框是等待用户反馈的方案：保留成员并删除以该分组为端点的连线，或取消操作。它不会猜测哪个子节点应继承端点。注释关联采用原型启发式规则；已检查注释正文保留，但尚未确立通用的注释归属规则。

## 证据与限制

见[观察记录](../../../../../.scratch/mermaid-editor/prototype-observations.zh-CN.md)和[截图](../../../../../.scratch/mermaid-editor/evidence/)。浏览器交互实际使用 React Flow 12.12.0、elkjs 0.12.0 和 Mermaid 12.2.0，在 Chromium 与 Playwright WebKit 中检查。WebKit 不能证明原生 Safari 独立应用或实际 iOS 设备已经验收。

原型通过锁定版本的 Mermaid **内部 FlowDB** 实验源码到图的转换，提交生成代码前对比语义，注释使用简单的关联启发式规则。这不能证明稳定公共 AST 或任意源码的往返保真。ELK 按层级计算节点位置，并将跨组连线投影到同层容器之间；显示的连线是自定义曲线，**没有**避障能力。原型不包含包体优化、Web Worker 布局接入、完整可访问性审查、实际输入法/设备验证、图片导出或工程持久化。这些限制仍是明确的后续工作；决策票在人工评审前保持开放。

路由与路由 ID 只存在于 `prototype/mermaid-workflow`，没有公开工具注册表入口或 sitemap 改动。正式实现应重新编写经过验证的行为，不应整份合并本原型。

[English](README.md)
