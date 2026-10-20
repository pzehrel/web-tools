# 公开工具界面改版验收

[已批准规格](https://github.com/pzehrel/web-tools/issues/1)已在 `codex/ui-redesign-spec-1` 实现。2026-10-20 的生产界面验收覆盖 **115/115 项需求**：103 组保留功能及 D01–D12。[机器可读矩阵](ui-redesign-acceptance.json)将每个唯一 ID 映射到结果和证据。[English](ui-redesign-acceptance.md)。

验收集成树以 `671dcd4` 为基线，包含本次验收提交中的手机菜单修复，通过现有 Cloudflare 静态资源处理器在隔离的本地来源提供。最终验收工单为 [#13](https://github.com/pzehrel/web-tools/issues/13)，复用已完成工具工单的详细证据。本次验收不包含部署。

| 范围                  | 可观察证据                                                                                                                                | 证据包条目                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 首页、共享导航与主题  | 四个公开入口；两个隐藏工具的直接路由；保留 query/hash 的旧别名；未知路由回退；系统/浅色/深色持久化及键盘导航                              | `evidence-2.md`、`browser-site-13.log`、`browser-site-webkit-13.log`                           |
| URL 与二维码          | 递归编辑及移动；解码后的 320px 纯二维码 / 1400px 组合 PNG；识别、分享、显式快照/更新及遗产转换                                            | `evidence-3.md`、`evidence-4.md`                                                               |
| 帧动画                | 真实文件/ZIP/目录导入；裁剪、播放/范围/定位；源分辨率精灵图；编译后 CSS/SCSS/Less 时序；完整原始归档及恢复                                | `evidence-5.md`、`evidence-6.md`、`evidence-7.md`                                              |
| Lottie                | 两种库/渲染器；资源警告且不抓取远程图片；独立画布；优化/指标；解包后的 ZIP 及持久化原始资源/设置                                          | `evidence-8.md`、`evidence-9.md`                                                               |
| 点九图                | 源边距及 HUD 手势；独立逻辑尺寸；识别/裁剪异步归属；解码后精确裁剪像素；可调用 CSS 及持久化原始源图/设置                                  | `evidence-10.md`、`evidence-11.md`、`evidence-12.md`                                           |
| 集成记录与查看        | 同一来源中四工具记录在导航/刷新后仍保留并相互隔离。原有 URL/二维码记录 ID 及时间戳在转换后保留。共享查看控件与编辑防护保持输出隔离        | `evidence-13.md`、`browser-cross-13.log`、`browser-cross-webkit-13.log`及上述工具专项证据      |
| 布局与层级            | 宽/紧凑桌面及 390/320px 手机双主题；有边界的导航位于工作区控件上方；二维码/裁剪弹窗位于顶栏上方；任务控件可达                             | `evidence-13.md`、`browser-cross-13.log`、`browser-cross-webkit-13.log`及工具专项手机/触摸证据 |
| SSG、浏览器资源与隔离 | 七个直接页面及回退返回 HTTP 200，水合后只有一份内容且元数据正确；全部八个 manifest/图标资源与基线字节一致；无原型导入、色板选择器或数据库 | `browser-site-13.log`、`browser-site-webkit-13.log`、`assets-isolation-13.json`                |
| 原生 Safari 网页 App  | 独立本地 QA App 安装后以独立窗口启动；首页/帧动画导航、示例播放、深色主题及退出/重启持久化正常                                            | `evidence-native-safari.md`、`native-safari-frame-dark.png`、`native-safari-relaunch.png`      |

矩阵中的证据文件名指向 `/tmp/web-tools-spec-1` 实现审计包；它们是验证产物，不是运行时依赖。已批准规格及关联工单讨论保留工单级决策。原始设计参考和用户现有工作区与实现分支保持分离。

全部必需检查通过：`pnpm lint`（零错误、20 条已有警告）、`pnpm typecheck`、`pnpm test`（9 个文件 / 67 项测试）及 `pnpm build`。构建仍保留已有 Lottie eval/包体积及旧路由重定向 SSR 警告。F06 明确不跟随播放高亮缩略图；U17 明确采用直接下载而无下拉菜单。

原生 Safari 覆盖启动/导航/主题/播放冒烟检查；完整导出和记录流程使用 Chromium 与持久化 WebKit。WebKit 私密模式的 Blob 存储限制保留已捕获、可重试反馈；持久化 Blob 记录在隔离的持久化配置中验证。Lottie 裁边可能移除浏览器抗锯齿产生的低透明度边缘采样；不透明逻辑采样及图集/旋转源像素与独立夹具一致。这不代表浏览器对每个边缘像素的重采样完全相同。
