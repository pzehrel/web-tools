# 工程技能配置草稿

Status: draft — awaiting final configuration review

已确认：GitHub Issues、默认五个标签、按应用分开的领域文档。此处展示待写入的完整新增配置，尚未修改正式文件或 GitHub 标签。

## 写入范围

- 在现有 `AGENTS.md` 末尾增加下列 `Agent skills` 入口，保留其余内容。
- 新增三份配置及其完整中文译本。下方中文入口段是新增英文段的审阅译文。
- 补建 `needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`；复用已有 `wontfix`，保留其他标签。
- 领域文档位置先配置，不创建空词汇表、根索引或 ADR 占位。已有 12 张本地任务不在此次 setup 中迁移。

## AGENTS.md：新增入口

```markdown
## Agent skills

### 任务跟踪

读取或发布规格、任务票、规划工作前，阅读 `pzehrel/web-tools` 的 [GitHub 跟踪流程](docs/agents/issue-tracker.zh-CN.md)。

### 分诊标签

对任务进行分诊或修改标签前，阅读[五角色标签映射](docs/agents/triage-labels.zh-CN.md)。

### 领域文档

探索领域行为或提出架构变更前，阅读 web 与 server 应用的[多上下文领域文档规则](docs/agents/domain.zh-CN.md)。
```

## docs/agents/issue-tracker.zh-CN.md

```markdown
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

现有 `.scratch/` 规格和任务保留为本地历史。本次 setup 不迁移、删除或关闭它们。用户要求迁移时，复用已确认范围和依赖，并记录对应 GitHub URL；本地与远端副本不视为两个任务。
```

## docs/agents/domain.zh-CN.md

```markdown
# 领域文档

## 布局

本仓库按应用划分上下文，使用根索引。以下路径相对仓库根，表示选定的位置，不代表每个文档已经存在。

| 范围 | 词汇表 | 架构决策 |
| --- | --- | --- |
| 索引／跨应用 | `GLOSSARY-MAP.md` | `docs/adr/` |
| Web 应用 | `apps/web/GLOSSARY.md` | `apps/web/docs/adr/` |
| Server 应用 | `apps/server/GLOSSARY.md` | `apps/server/docs/adr/` |

## 读写规则

- 探索领域前，根 map 存在时先读，再读各相关应用的词汇表。跨应用变更需要两个上下文。
- 提出架构方案前，阅读相关跨应用 ADR 和受影响应用的 ADR。
- map、词汇表或 ADR 目录不存在时，静默继续，不创建空文档或预先占位。领域建模在术语或决策明确时，按需创建 map、条目、词汇表与 ADR。
- 在任务、假设、方案、测试和面向代码的解释中一致使用词汇表术语。所需术语缺失时，检查项目既有用法，将真实缺口留给领域建模，不另造竞争性同义词。
- 方案与既有 ADR 冲突时，指出该 ADR 并解释重新讨论的理由，不静默覆盖。
- 应用专属决策放在该应用 ADR 目录，共享决策放在根 ADR 目录。创建应用词汇表时同步根 map。仅在应用存在且领域边界实际成立后新增上下文。
- 英文文档为规范版本，另附完整对应的 `.zh-CN.md`。规范 map 与文档链接指向规范文件；面向人的译本可以链接对应译本。
```

## docs/agents/triage-labels.zh-CN.md

```markdown
# 分诊标签

五个规范角色直接映射到 `pzehrel/web-tools` 的同名 GitHub 标签。

| 规范角色 | GitHub 标签 | 含义 |
| --- | --- | --- |
| `needs-triage` | `needs-triage` | 需要维护者评估。 |
| `needs-info` | `needs-info` | 等待报告者补充信息。 |
| `ready-for-agent` | `ready-for-agent` | 规格完整，适合代理实施；仍须遵守阻塞依赖。 |
| `ready-for-human` | `ready-for-human` | 需要人工实施。 |
| `wontfix` | `wontfix` | 不予处理。 |

技能提及角色时应用对应标签。保留其他现有标签；分诊角色不能替代依赖或领取状态检查。
```
