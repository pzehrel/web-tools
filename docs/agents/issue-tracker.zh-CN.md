# 任务跟踪：GitHub

规格和实施任务使用 `pzehrel/web-tools` 的 GitHub Issues 跟踪。使用 `gh` CLI，仓库级命令带上 `--repo pzehrel/web-tools`。

## Issue 操作

- 发布规格或任务：`gh issue create --repo pzehrel/web-tools --title "<title>" --body-file <body-file>`。多行内容先保存为 UTF-8 文件，再用 `--body-file` 传入。
- 读取完整正文与讨论：`gh issue view <number> --repo pzehrel/web-tools --json number,title,body,labels,comments,assignees,state`。
- 列表：`gh issue list --repo pzehrel/web-tools --state open --limit 100 --json number,title,body,labels,assignees`，按需要增加标签过滤。完整分诊时通过 `gh api --paginate` 遍历分页，不将一次限量响应视为全部结果。
- 评论：`gh issue comment <number> --repo pzehrel/web-tools --body-file <comment-file>`。
- 编辑正文：`gh issue edit <number> --repo pzehrel/web-tools --body-file <body-file>`。
- 添加／移除标签：`gh issue edit <number> --repo pzehrel/web-tools --add-label <label>` 或 `--remove-label <label>`。角色名称遵循[标签映射](triage-labels.zh-CN.md)。
- 关闭任务：`gh issue close <number> --repo pzehrel/web-tools`；需要说明完成情况时，先通过 `--body-file` 发布说明，再关闭。

技能要求“发布到 issue tracker”时，创建 GitHub issue；要求“读取相关任务”时，读取完整正文与评论。裸 issue 编号按本仓库解析。

## 父子任务与阻塞依赖

- 按依赖顺序创建子任务：`gh issue create --repo pzehrel/web-tools --parent <parent-number> --blocked-by <blocker-number,...> --title "<title>" --body-file <body-file>`；无依赖时省略依赖参数。已安装 CLI 支持这两个参数。
- 关联已有子任务：先用 `gh api repos/pzehrel/web-tools/issues/<child-number> --jq .id` 取得数字数据库 ID，再用 `gh api --method POST repos/pzehrel/web-tools/issues/<parent-number>/sub_issues -F sub_issue_id=<child-database-id>` 关联。
- 关联已有依赖：以同样方式取得阻塞任务的数据库 ID，再调用 `gh api --method POST repos/pzehrel/web-tools/issues/<child-number>/dependencies/blocked_by -F issue_id=<blocker-database-id>`。数据库 ID 不同于 issue 编号和 GraphQL node ID。
- 优先原生子任务与原生阻塞关系。仓库能力不可用时，子任务写 `Part of #<parent>`，父任务维护清单；依赖写 `Blocked by: #<number>, #<number>`。明确记录该回退。
- ready-for-agent 任务只有在所有阻塞任务关闭且未被领取时才可开始；ready 标签本身不会解除依赖。

## PR 是否作为分诊请求入口

**PRs as a request surface: no.**

GitHub issue 与 PR 共享编号空间。引用有歧义时，操作前先确认类型。

## 规划工作

- map 是带 `wayfinder:map` 标签的 GitHub issue，包含 Notes、Decisions-so-far 和 Fog。
- 每个 research／prototype／grilling／task 子任务关联 map，使用 `wayfinder:<type>`。流程实际需要时才创建缺失的规划标签；setup 仅创建已配置的分诊标签。
- 从未关闭、无未完成阻塞、无负责人子任务中按 map 顺序确定可开始集合。原生 `issue_dependencies_summary.blocked_by` 统计未关闭阻塞；文本回退需要逐个检查引用任务。
- 开始任务工作前，先分配给执行者领取：`gh issue edit <number> --repo pzehrel/web-tools --add-assignee @me`。
- 解决时发布答案、关闭子任务，并在 map 的 Decisions-so-far 增加摘要与链接。遵循当前技能范围：发布任务票不关闭或修改父任务。

## 既有本地规划记录

UI 重设计规格及十二张实施任务已于 2026-10-20 迁移到 [GitHub 父任务](https://github.com/pzehrel/web-tools/issues/1)。保留的规格与决策见[设计资料索引](../ui-redesign/design-decisions.zh-CN.md)。本地文档作为参考，不形成第二套任务跟踪；任务状态和依赖以 GitHub 为准。
