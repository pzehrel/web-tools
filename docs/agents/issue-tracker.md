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

The UI-redesign specification and twelve implementation tickets were migrated to the [GitHub parent issue](https://github.com/pzehrel/web-tools/issues/1) on 2026-10-20. Retained specifications and decisions are indexed in the [design reference](../ui-redesign/design-decisions.md). Local documents are references, not a second task tracker; task state and dependencies remain in GitHub.
