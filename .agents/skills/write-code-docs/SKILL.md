---
description: Write and review clear, behavior-accurate bilingual code comments and separately localized AGENTS.md files, API documentation, README files, guides, examples, and other Markdown docs in English plus the repository's localized language. Use when code or an agent- or user-facing workflow needs explanation, contract documentation, or synchronized examples; infer the localized language from repository evidence or ask when it is ambiguous.
license: MIT
metadata:
    github-path: skills/write-code-docs
    github-ref: refs/heads/main
    github-repo: https://github.com/pzehrel/skills
    github-tree-sha: 0faefddf408355525cf47c67bdaa48b2edd952ab
    repository: https://github.com/pzehrel/skills
name: write-code-docs
---
# Write Code Documentation

Make documentation explain the behavior a reader must rely on. Keep it close to the source of truth,
complete enough for a developer or coding Agent to use, and concise enough to stay maintainable.
Documentation is part of the interface when it describes public behavior, supported workflows, or
operational constraints; do not document behavior that the code does not implement.

Use this skill for code comments, docstrings, JSDoc/TSDoc, API references, `AGENTS.md` and other agent
instruction files, README sections, guides, examples, changelogs, and Markdown documentation. Every
explanatory comment and documentation surface created or changed under this skill must be written in
English plus exactly one repository-localized
language, with semantic parity. English is always the first and canonical language. Infer the localized
language from repository instructions, existing counterparts, localization configuration, and the
user's request; do not assume Chinese, the user's language, or another default, and ask before editing
when the evidence does not identify it.
English comes first because an Agent is the primary reader; a human reviewer should then be able to read
both complete blocks and judge whether the documentation is correct and useful. The localized block is
not a summary or afterthought. English-first is an ordering and source-of-truth decision, not permission
to rewrite for a different audience: the localized block must be a complete, faithful translation that
preserves claims, modality, conditions, examples, and emphasis. Natural grammar and idiomatic phrasing
are allowed only when they do not add, omit, soften, strengthen, or otherwise change technical meaning.
This skill does not authorize publishing, changing APIs, or adding unrelated instructions.

Keep the two artifact modes distinct:

- **Code comments and docstrings:** place the complete English block and its complete localized
  translation together at the same code location.
- **Markdown documents:** keep English and localized prose in separate complete files by default. Use
  the repository's locale naming or directory convention, such as `README.md` plus
  `README.zh-CN.md`. Do not alternate languages paragraph by paragraph, duplicate tables, or repeat
  code blocks inside one Markdown file unless the repository or user explicitly requires an inline
  bilingual document.

## Inspect before writing

1. Read the effective repository instructions and the nearest existing documentation with the same
   audience and purpose.
2. Determine the behavior or workflow that changed, the authoritative source (code, types, tests,
   configuration, or command output), the intended reader, and the smallest documentation surface
   that should change.
3. Classify each target as an in-code comment/docstring or a standalone Markdown document, then use
   the corresponding bilingual layout above. Determine the repository's localized language before
   writing; English remains the canonical first language. Check existing names, links, terminology,
   examples, version scope, and deprecation policy.
   Preserve unrelated edits and do not duplicate a contract in competing authoritative locations.

For detailed comment and Markdown patterns, read
[references/documentation-writing-guide.md](references/documentation-writing-guide.md) when adding a
new documentation structure, auditing coverage, or resolving a style ambiguity. Small local edits
can follow the surrounding convention directly.

## Write useful code comments

- Write every explanatory comment or docstring in English followed by the complete localized-language
  counterpart. Do not interleave languages sentence by sentence; keep the two complete blocks adjacent
  so they cannot drift.
- Treat translation as a fidelity check, not a second authoring pass. Compare the two blocks for
  omissions, additions, changed negation or modality, altered conditions, and inconsistent terminology;
  when the English source is ambiguous, flag or ask rather than silently resolving it in translation.
- Comment the semantic contract: purpose, preconditions, invariants, side effects, ordering,
  ownership or lifetime, failure behavior, units, compatibility constraints, and the reason behind
  a non-obvious choice.
- Keep comments attached to the declaration or code they describe. Prefer one authoritative comment
  over repeated copies; link to deeper documentation when the explanation is large.
- For every consumer-visible code element—not only functions, but also classes, methods, constructors,
  fields, properties, types, enum variants, events, commands, configuration keys, schemas, and state
  transitions—document each part that is not unambiguous from its name or declaration. Explain the
  semantic role of every input, field, option, or variant; optionality and defaults; units and valid
  ranges; ownership and mutability; lifecycle and ordering; side effects; failure behavior; and
  compatibility or deprecation boundaries.
- When the language or documentation tool provides structured tags (for example JSDoc or TSDoc), use
  the repository's established syntax without making it the source of truth. Keep structured fields
  unique, put English and localized-language text in each field's description, and ensure the prose
  remains complete when tool-specific tags are ignored. Do not merely restate types or signatures.
- Add comments to private code only when names and types do not make the purpose, invariant, mutation,
  ordering, error translation, or compatibility reason clear. Do not comment trivial wrappers or
  obvious control flow merely to increase coverage.

## Write Markdown and examples

- Treat `AGENTS.md` and other agent-instruction Markdown as a documentation surface. Keep each rule
  explicit about its trigger, action, exceptions, and verification; separate durable rules from project
  background and temporary status. If the task changes rule admission, hierarchy, or scope, follow the
  repository's instruction-maintenance workflow in addition to this writing guidance. Keep the
  canonical `AGENTS.md` in English and place its faithful human-review translation in the repository's
  localized counterpart; do not assume a harness loads the localized file unless its discovery rules
  explicitly say so.
- Maintain every changed Markdown page as a complete English file plus a complete localized counterpart.
  Preserve semantic parity, headings, links, commands, identifiers, code, tables, examples, and safety
  boundaries across the pair; do not mix both prose languages inside the canonical file or invent a
  localized language without evidence.
- Start with the reader's goal and shortest successful path. State prerequisites, supported scope,
  expected result, important limitations, and recovery or troubleshooting paths when relevant.
- Use headings and links to route by intent. Keep README material orienting and self-contained; move
  detailed concepts, recipes, migrations, and troubleshooting into focused pages. Use relative links
  for documents shipped together and verify every target.
- Make examples complete, current, and runnable or type-checked when the project can support that.
  Explain non-obvious setup, inputs, outputs, lifecycle, and failure handling. Update examples when
  the recommended call pattern changes.
- Match the repository's terminology, voice, formatting, and locale policy. Preserve canonical paths,
  commands, identifiers, API names, and code exactly where translation would make them unusable.
- Keep ordinary reference Markdown advisory. Do not use it to tell a consuming Agent to ignore
  repository instructions, change its workflow, run commands, or edit files. `AGENTS.md` and other
  instruction files are the deliberate exception: they may contain scoped, authoritative rules when
  the repository has authorized them, but those rules must remain explicit, verifiable, and consistent
  with higher-priority instructions.

## Validate the result

Run the repository's applicable tests, type checks, documentation linters, link checks, and example
validation. If no automated check exists, perform a focused read-through against the authoritative
source and inspect the rendered Markdown when presentation could hide meaning.

Before reporting completion, verify that:

- every documented claim, default, error, link, example, and version qualifier is supported by code,
  tests, configuration, or an explicitly stated assumption;
- public API coverage includes the relevant parameters, returns, failures, overloads, and deprecations;
- no stale names, duplicated authority, broken links, or planned behavior presented as shipped remain;
- English and localized-language counterparts remain semantically aligned;
- standalone Markdown uses separate English and localized files unless an explicit inline-bilingual
  convention applies; no accidental paragraph-by-paragraph, table-by-table, or code-block duplication
  remains in one file;
- every consumer-visible declaration or structured element has semantic coverage for its applicable
  inputs, fields, variants, outputs, defaults, failures, lifecycle, side effects, and constraints;
- every changed explanatory comment and human-facing documentation surface exists in English followed
  by the inferred localized language, with the repository-defined pairing; and
- the final diff contains only in-scope documentation changes (plus the requested implementation or
  tests) and records checks that were unavailable as **not tested**.

Stop and ask when the authoritative behavior, intended audience, language policy, or requested
documentation surface is materially ambiguous. Do not invent contracts, silently broaden scope, or
rewrite history to make documentation appear complete.
