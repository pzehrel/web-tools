# Web UI 重设计实施任务索引

> 已于 2026-10-20 迁移到 GitHub Issues：[实施规格父任务](https://github.com/pzehrel/web-tools/issues/1)。本页和原始本地票保留为同一批任务的迁移快照；后续领取和状态以 GitHub 为准，不能重复领取。完整中英文正文、父子关系和阻塞依赖已核对。

Status: ready-for-agent
Labels: ready-for-agent
Date: 2026-10-20
Canonical language: English

用户已于 2026-10-20 以“可以”确认 12 张票的粒度和依赖；现已按每票一个文件发布。每张票另有完整中文译本，两个语言版本代表同一张任务，不是两个任务。

[英文原文](tickets.md) · [实施规格](spec.zh-CN.md) · [来源索引](sources.zh-CN.md) · [机器可读依赖与覆盖](tickets.json)

## 任务

| 编号 | 任务                                                                                   | 依赖               | 状态            |
| ---- | -------------------------------------------------------------------------------------- | ------------------ | --------------- |
| 01   | [首页、导航与正式主题](issues/01-home-navigation-themes.zh-CN.md)                      | 无                 | ready-for-agent |
| 02   | [URL 递归编辑与分享链接往返](issues/02-url-tree-sharing.zh-CN.md)                      | 01                 | ready-for-agent |
| 03   | [URL 二维码输入、直接下载与持久记录](issues/03-url-qr-records.zh-CN.md)                | 02                 | ready-for-agent |
| 04   | [帧素材导入、全宽序列与共同透明边裁剪](issues/04-frames-import-sequence-crop.zh-CN.md) | 01                 | ready-for-agent |
| 05   | [帧播放、独立进度与画布查看](issues/05-frames-playback-canvas.zh-CN.md)                | 04                 | ready-for-agent |
| 06   | [帧精灵图／代码导出与完整项目恢复](issues/06-frames-export-records.zh-CN.md)           | 05                 | ready-for-agent |
| 07   | [Lottie 项目导入、播放与窄栏任务工作区](issues/07-lottie-import-playback.zh-CN.md)     | 01                 | ready-for-agent |
| 08   | [Lottie 图集优化、ZIP 验证与项目恢复](issues/08-lottie-atlas-export-records.zh-CN.md)  | 07                 | ready-for-agent |
| 09   | [点九图切线、渲染与独立预览 HUD](issues/09-nine-patch-editor-hud.zh-CN.md)             | 01                 | ready-for-agent |
| 10   | [点九图自动分析、中心裁剪与像素导出](issues/10-nine-patch-analysis-crop.zh-CN.md)      | 09                 | ready-for-agent |
| 11   | [点九图 CSS 复用与持久项目恢复](issues/11-nine-patch-css-records.zh-CN.md)             | 09                 | ready-for-agent |
| 12   | [跨工具产品验收与原型隔离](issues/12-production-acceptance.zh-CN.md)                   | 03, 06, 08, 10, 11 | ready-for-agent |

## 领取顺序与验收

- 当前可开始：01。其余任务在依赖完成后可领取；`ready-for-agent` 表示已具备实施规格，不表示已解除依赖或完成。
- 01 完成后，02、04、07、09 可独立推进；09 完成后，10、11 可独立推进。12 等待所有末端任务完成。
- 103 组现有功能与 12 项 UI 决策均有唯一主要负责票，并有跨票检查；产品验收仍为 pending。每票内有未勾选的验收条件。
- 在真实页面验收输入、编辑、预览、导出、记录与刷新，复用现有模块测试。导出检查实际内容；记录测试隔离数据并保留原存储契约。
- 草案保留为审批历史，由本索引及独立正式票替代其发布状态。父规格和既有规划记录未修改。此次只发布任务，尚未实施产品改动。

## GitHub migration

| 本地编号 | GitHub 任务                                                                                 | GitHub 阻塞依赖      |
| -------- | ------------------------------------------------------------------------------------------- | -------------------- |
| 01       | [#2 — 首页、导航与正式主题](https://github.com/pzehrel/web-tools/issues/2)                  | 无                   |
| 02       | [#3 — URL 递归编辑与分享链接往返](https://github.com/pzehrel/web-tools/issues/3)            | #2                   |
| 03       | [#4 — URL 二维码输入、直接下载与持久记录](https://github.com/pzehrel/web-tools/issues/4)    | #3                   |
| 04       | [#5 — 帧素材导入、全宽序列与共同透明边裁剪](https://github.com/pzehrel/web-tools/issues/5)  | #2                   |
| 05       | [#6 — 帧播放、独立进度与画布查看](https://github.com/pzehrel/web-tools/issues/6)            | #5                   |
| 06       | [#7 — 帧精灵图／代码导出与完整项目恢复](https://github.com/pzehrel/web-tools/issues/7)      | #6                   |
| 07       | [#8 — Lottie 项目导入、播放与窄栏任务工作区](https://github.com/pzehrel/web-tools/issues/8) | #2                   |
| 08       | [#9 — Lottie 图集优化、ZIP 验证与项目恢复](https://github.com/pzehrel/web-tools/issues/9)   | #8                   |
| 09       | [#10 — 点九图切线、渲染与独立预览 HUD](https://github.com/pzehrel/web-tools/issues/10)      | #2                   |
| 10       | [#11 — 点九图自动分析、中心裁剪与像素导出](https://github.com/pzehrel/web-tools/issues/11)  | #10                  |
| 11       | [#12 — 点九图 CSS 复用与持久项目恢复](https://github.com/pzehrel/web-tools/issues/12)       | #10                  |
| 12       | [#13 — 跨工具产品验收与原型隔离](https://github.com/pzehrel/web-tools/issues/13)            | #4, #7, #9, #11, #12 |
