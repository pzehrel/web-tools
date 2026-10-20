# 规格来源索引

Date: 2026-10-20

本索引支持英文规格及其中文译本，内容是来源指针，不是实现指令。规格已按配置的本地 Markdown tracker 发布，状态为 `ready-for-agent`；本索引不是第二张任务票。

## 决定与优先关系

1. 用户于 2026-10-20 完成原型评审，要求隐藏工具的入口继续隐藏，并在 to-spec 阶段明确确认以产品页面为主的测试边界。
2. 最新已评审行为、[当前原型映射](../../docs/ui-redesign/prototype-current.zh-CN.md)与保留验收共同作为依据。[视觉方向结论](../web-ui-redesign/issues/03-visual-direction.md#answer)记录已确认的 F 方向与范围。
3. 保留范围内全部 103 组既有功能。[历史基线总览](../../docs/ui-redesign/README.zh-CN.md)及明细表定义行为，不表示当前原型完成度。F06 随播放高亮与 U17 下载菜单交互，仅按规格中的明确决定替代。
4. [验证记录](../../docs/ui-redesign/prototype-validation.json)是带日期与边界的证据，不代表正式产品浏览器验收。配套需求清单记录覆盖及待验收状态，不记录虚构的测试通过。

## 功能来源

| 规格 ID          | 保留基线                                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G01–G09          | [共享行为](../../docs/ui-redesign/features/shared.zh-CN.md)                                                                                                                           |
| U01–U25          | [URL 与二维码](../../docs/ui-redesign/features/url.zh-CN.md)                                                                                                                          |
| F01–F20、L01–L20 | [帧动画与 Lottie](../../docs/ui-redesign/features/motion.zh-CN.md)                                                                                                                    |
| N01–N29          | [点九图](../../docs/ui-redesign/features/nine.zh-CN.md)                                                                                                                               |
| D01–D12          | [当前原型](../../docs/ui-redesign/prototype-current.zh-CN.md)、[色彩评审](../../docs/ui-redesign/color-system.zh-CN.md)、[评审历史](../web-ui-redesign/issues/03-visual-direction.md) |

## 已确认的原型依据

- [共享工作台、首页与导航](../../apps/web/src/ui-redesign-workspace.prototype.tsx)
- [共享原型样式](../../apps/web/src/ui-redesign.prototype.scss)
- [URL 与二维码](../../apps/web/src/ui-redesign-url.prototype.tsx)
- [帧动画](../../apps/web/src/ui-redesign-frames-full.prototype.tsx)
- [Lottie](../../apps/web/src/ui-redesign-lottie-full.prototype.tsx)
- [点九图](../../apps/web/src/ui-redesign-nine-full.prototype.tsx)、[HUD](../../apps/web/src/ui-redesign-nine-hud.prototype.tsx)和 [HUD 几何](../../apps/web/src/ui-redesign-hud-geometry.prototype.ts)
- [集中颜色令牌](../../apps/web/src/index.scss)

[URL 自评](../../docs/ui-redesign/url-review.zh-CN.md)包含一版被拒绝的布局及明确的恢复记录。该版本是历史资料，不覆盖之后的顶部等高行、全宽树与记录决定。当前活动原型及按时间记录的反馈优先于早期截图。

## 既有测试边界

- [URL 解析与树操作](../../apps/web/src/tools/url-parser/url-tree.test.ts)
- [舞台适配与缩放](../../apps/web/src/lib/stage.test.ts)
- [旧记录转换](../../apps/web/src/lib/storage/legacy.test.ts)
- [帧动画归档往返](../../apps/web/src/tools/frame-animation/records.test.ts)
- [Lottie 归档](../../apps/web/src/tools/lottie-preview/records.test.ts)、[资源](../../apps/web/src/tools/lottie-preview/lottie-assets.test.ts)、[动态图片](../../apps/web/src/tools/lottie-preview/image-animation.test.ts)和[指标](../../apps/web/src/tools/lottie-preview/resource-metrics.test.ts)
- [点九图切片范围](../../apps/web/src/tools/nine-patch/slice-bounds.test.ts)

这些是既有模块边界。已确认的主要验收边界是真实产品页面，覆盖用户可见流程、真实导出和记录。当前仓库未发现正式产品的浏览器验收套件。最近几轮原型浏览器执行不可用，生产验收矩阵继续待执行。

## 范围与规划历史

[决策地图](../web-ui-redesign/map.md)、[任务基准](../web-ui-redesign/issues/01-target-workflows.md#answer)和[导航决定](../web-ui-redesign/issues/02-information-architecture.md#answer)保留规划历史。后续用户决定暂缓隐藏工具，并隐藏其全部导航入口。本规格依据该评审与已确认测试边界，汇总工作台、共享交互和验收问题；发布规格不隐式改变其他规划票的状态。

本规格步骤不修改产品代码。拆票、实施、在版本控制中归档原型和发版仍是独立步骤，遵守各自已有范围约束。
