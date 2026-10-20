# Engineering skills configuration draft

Status: draft — awaiting final configuration review

Confirmed: GitHub Issues, the five default triage labels and application-scoped domain docs. This is the full proposed new configuration; production configuration files and GitHub labels have not been changed.

## Write scope

- Append the following `Agent skills` pointers to the existing `AGENTS.md`, preserving surrounding content.
- Add the three configuration files and their complete Chinese counterparts. The Chinese pointer block below is the review translation of the new English block.
- Create missing `needs-triage`, `needs-info`, `ready-for-agent` and `ready-for-human` labels; reuse existing `wontfix` and preserve other labels.
- Configure domain locations without creating empty glossaries, a placeholder map or ADRs. Migrating the 12 existing local tickets is outside this setup.

## AGENTS.md: added pointers

```markdown
## Agent skills

### Issue tracker

Before reading or publishing specs, tickets or wayfinding work, read [the GitHub tracker workflow](docs/agents/issue-tracker.md) for `pzehrel/web-tools`.

### Triage labels

Before triaging or changing issue labels, read [the five-role label mapping](docs/agents/triage-labels.md).

### Domain docs

Before exploring domain behavior or proposing architecture changes, read [the multi-context domain documentation rules](docs/agents/domain.md) for the web and server applications.
```

## docs/agents/issue-tracker.md

```markdown
# Issue tracker: GitHub

Specs and implementation issues are tracked in GitHub Issues for `pzehrel/web-tools`. Use the `gh` CLI with `--repo pzehrel/web-tools` for repository-scoped commands.

## Issue operations

- Publish a spec or ticket: `gh issue create --repo pzehrel/web-tools --title "<title>" --body-file <body-file>`. Store multiline text in a UTF-8 file and pass it with `--body-file`.
- Read the full issue and discussion: `gh issue view <number> --repo pzehrel/web-tools --json number,title,body,labels,comments,assignees,state`.
- List issues: `gh issue list --repo pzehrel/web-tools --state open --limit 100 --json number,title,body,labels,assignees`, adding relevant label filters. For exhaustive triage, follow pagination through `gh api --paginate`; do not assume one limited response is complete.
- Comment: `gh issue comment <number> --repo pzehrel/web-tools --body-file <comment-file>`.
- Edit a body: `gh issue edit <number> --repo pzehrel/web-tools --body-file <body-file>`.
- Add/remove labels: `gh issue edit <number> --repo pzehrel/web-tools --add-label <label>` or `--remove-label <label>`. Role names follow [the label mapping](triage-labels.md).
- Close an issue: `gh issue close <number> --repo pzehrel/web-tools`; when a completion explanation is needed, post it with `--body-file` before closing.

When a skill says “publish to the issue tracker”, create a GitHub issue. When it says “fetch the relevant ticket”, read its full body and comments. Resolve bare issue numbers within this repository.

## Parent issues and blocking edges

- Create children in dependency order: `gh issue create --repo pzehrel/web-tools --parent <parent-number> --blocked-by <blocker-number,...> --title "<title>" --body-file <body-file>`; omit blocker flags when there are none. The installed CLI supports both flags.
- For an existing child, fetch its numeric database ID with `gh api repos/pzehrel/web-tools/issues/<child-number> --jq .id`, then attach it using `gh api --method POST repos/pzehrel/web-tools/issues/<parent-number>/sub_issues -F sub_issue_id=<child-database-id>`.
- For an existing dependency, fetch the blocker's database ID the same way, then call `gh api --method POST repos/pzehrel/web-tools/issues/<child-number>/dependencies/blocked_by -F issue_id=<blocker-database-id>`. Database IDs are different from issue numbers and GraphQL node IDs.
- Native sub-issues and native blocking edges are preferred. If a repository capability is unavailable, use `Part of #<parent>` in the child with a parent task list, and a `Blocked by: #<number>, #<number>` line for dependencies. State that fallback explicitly.
- A ready-for-agent issue is available only when all blockers are closed and it is unclaimed. The ready label alone does not remove blockers.

## Pull requests as a triage surface

**PRs as a request surface: no.**

GitHub issues and pull requests share a number space. If a reference is ambiguous, resolve its type before acting.

## Wayfinding

- The map is a GitHub issue labelled `wayfinder:map`, containing Notes, Decisions-so-far and Fog.
- Each research/prototype/grilling/task child links to that map and carries `wayfinder:<type>`. Create a missing wayfinding label when the workflow actually needs it; setup creates only the configured triage labels.
- Determine the frontier from open children with no open blockers and no assignee, in map order. Native `issue_dependencies_summary.blocked_by` counts open blockers; textual fallbacks require checking each referenced issue.
- Claim by assigning the driving developer before doing ticket work: `gh issue edit <number> --repo pzehrel/web-tools --add-assignee @me`.
- Resolve by posting the answer, closing the child and adding a gist/link to the map's Decisions-so-far. Follow the invoked skill's scope: ticket publication does not close or modify a parent.

## Existing local planning records

The existing `.scratch/` specs and tickets remain local history. This setup does not migrate, delete or close them. When migration is requested, reuse their approved scope and dependencies and record the corresponding GitHub URLs; do not treat local and remote copies as separate tasks.
```

## docs/agents/domain.md

```markdown
# Domain documentation

## Layout

This repository uses application-scoped contexts with a root index. Paths below are relative to the repository root and describe the chosen locations, not a claim that every document already exists.

| Scope | Glossary | Architecture decisions |
| --- | --- | --- |
| Index / cross-application | `GLOSSARY-MAP.md` | `docs/adr/` |
| Web application | `apps/web/GLOSSARY.md` | `apps/web/docs/adr/` |
| Server application | `apps/server/GLOSSARY.md` | `apps/server/docs/adr/` |

## Reading and writing rules

- Before domain exploration, read the root map if it exists, then the glossary for each relevant application. A cross-application change needs both contexts.
- Read relevant cross-application ADRs and the affected applications' ADRs before making an architectural proposal.
- If the map, glossary or ADR directory is absent, proceed silently. Do not create empty documents or upfront placeholders. Domain modeling creates the map, entries, glossaries and ADRs lazily when terminology or decisions are resolved.
- Use glossary terms consistently in tickets, hypotheses, proposals, tests and code-facing explanations. When a needed term is absent, check established project usage and note a real gap for domain modeling rather than inventing a competing synonym.
- If a proposal conflicts with an existing ADR, identify the ADR and explain why reopening it is justified; do not silently override it.
- Put application-specific decisions in that application's ADR directory and shared decisions in the root ADR directory. Keep the root map synchronized as application glossaries are created. Add contexts only when an application exists and a domain boundary is actually established.
- English documents are canonical, with separate faithful `.zh-CN.md` counterparts. Canonical maps and document links target canonical files; human-facing translations may link to their translated counterparts.
```

## docs/agents/triage-labels.md

```markdown
# Triage labels

These five canonical roles map directly to GitHub label names in `pzehrel/web-tools`.

| Canonical role | GitHub label | Meaning |
| --- | --- | --- |
| `needs-triage` | `needs-triage` | Maintainer assessment is required. |
| `needs-info` | `needs-info` | Waiting for information from the reporter. |
| `ready-for-agent` | `ready-for-agent` | Fully specified and suitable for an agent; blocking dependencies still apply. |
| `ready-for-human` | `ready-for-human` | Human implementation is required. |
| `wontfix` | `wontfix` | Will not be actioned. |

Apply the mapped label when a skill names a role. Preserve unrelated existing labels; a triage role does not replace dependency or assignment checks.
```
