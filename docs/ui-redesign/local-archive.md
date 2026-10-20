# Local design and research archive

This archive preserves the local design work that preceded the production redesign. The [production acceptance guide](../ui-redesign-acceptance.md) describes the shipped interface; the prototype reports and screenshots here describe historical experiments. [中文](local-archive.zh-CN.md).

## Contents

| Location                                                                                  | Purpose                                                                                             |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `.scratch/web-ui-redesign/`                                                               | Research, screenshots, prototype rounds and interaction evidence, preserved at their original paths |
| `.scratch/web-ui-redesign-implementation/`                                                | Historical specifications, ticket proposals and GitHub migration records                            |
| `.scratch/agent-skills-setup/`                                                            | Existing repository workflow setup records                                                          |
| [Snapshot manifest](../../.scratch/web-ui-redesign/local-worktree-snapshot/manifest.json) | Original paths, archive paths, byte counts and SHA-256 hashes for all 558 pending local files       |
| [Source snapshot](../../.scratch/web-ui-redesign/local-worktree-snapshot/files/)          | Old modified production files, prototype source and unchanged copies of the imported documents      |
| [Original patch](../../.scratch/web-ui-redesign/local-worktree-snapshot/worktree.patch)   | The original tracked-file changes against `e182467682589cbebae36ed9954d2f0ac4449fd4`                |
| [Agent guides](../agents/)                                                                | Existing paired tracker, label and domain-documentation guides                                      |

The research branch's `1d8fbf2` commit is retained in the branch history. Its report and the local table-formatting revision are both recoverable from that history. Existing historical files retain their original languages and contents; the manifest identifies the exact preserved bytes even when an imported working document receives formatting fixes.

## Runtime boundary

Production routes, styles, storage and Vite configuration stay on the completed redesign. Prototype files formerly under `apps/web/src` are preserved inside the source snapshot rather than restored into the TypeScript application. The pending root agent-instruction patch is also preserved in the snapshot; active root instructions stay on the production baseline. `.scratch` is an immutable historical input and is excluded from lint; production lint, type checking, tests and the SSG build remain enabled.

The snapshot records a delta from the named baseline, not a standalone runnable application. Reconstruct historical work in a separate checkout of that baseline using the manifest's path mapping. Its old coverage results, scripts and screenshots do not replace current production acceptance.
