# Documentation Writing Guide

Read this guide when a documentation change is broad enough to need a deliberate structure or a
coverage review. It complements the short routing rules in `SKILL.md`.

## Select the localized language

English is always the first and canonical language. Before writing, infer exactly one localized language
from the highest-confidence evidence: explicit user requirements, repository instructions, existing
filename pairs, localization configuration, and nearby documents with the same audience. Do not default
to Chinese, the user's language, or the most common language. If evidence conflicts or identifies no
localized language, ask the user before creating or changing documentation. Once selected, keep the
English file and localized translation semantically aligned; preserve code, commands, identifiers, and
links exactly.

## Translation fidelity

English-first serves Agent discovery and gives reviewers a stable source of truth. It does not permit
the localized version to become an adaptation. Translate the complete English block faithfully, then
review both blocks for:

- omitted or added claims, qualifiers, examples, or constraints;
- changed negation, certainty, obligation, permission, quantity, or conditional scope;
- inconsistent terminology for the same concept; and
- altered code tokens, paths, commands, identifiers, links, or error codes.

Idiomatic grammar is welcome, but technical meaning must not be softened, strengthened, or editorialized.
When the English source is ambiguous, flag the ambiguity or ask the user instead of resolving it silently.
Human review evaluates fidelity and readability; it is not a license for an independent rewrite.

## Agent instruction documents

`AGENTS.md` is a documentation surface and may be authoritative. Write its rules as explicit,
scoped prose: state the trigger, required action, exceptions, and verification. Keep durable rules
separate from project background and temporary status. This writing guide covers clarity, semantic
coverage, and bilingual presentation; a repository's instruction-maintenance workflow remains the
authority for admitting rules and changing hierarchy or scope.

The canonical `AGENTS.md` stays in English for Agent consumption. Put the precise human-review
translation in the repository's localized counterpart, such as `AGENTS.zh-CN.md`, and link it when
useful. A localized counterpart is not automatically authoritative or discoverable; only treat it as
loaded instructions when the relevant harness documents that behavior.

## Semantic comment coverage

For every consumer-visible code element, check the declaration, schema, or behavior a reader actually
sees. This includes functions, classes, methods, constructors, fields, properties, types, enum variants,
events, commands, configuration keys, schemas, and state transitions. Write the explanatory comment or
docstring in English first and then the complete localized-language counterpart. Do not interleave
sentences from the two languages.

A useful comment normally has a summary and, where applicable, explains:

- the semantic role of every input, field, option, or variant;
- optionality, defaults, units, valid ranges, ownership, and mutability;
- lifecycle, ordering, side effects, timing, retries, and cancellation;
- outputs, identity, caching, resource cleanup, and result representation;
- failures, rejected combinations, security constraints, and compatibility boundaries; and
- relationships between generic values, overloads, states, or related declarations.

Use the project's established syntax. Structured tags supplied by a language or tool (such as JSDoc or
TSDoc) are delivery aids, not the source of truth. Keep structured fields unique, put English and
localized-language text in each field's description, and ensure the prose remains complete when those
tags are ignored. Do not merely restate types or signatures.

For example, keep English prose first, followed by the complete localized-language prose, and keep tags
structurally singular:

```ts
/**
 * Loads the configuration file and validates its schema.
 * The returned object is detached from the parser's internal state.
 *
 * 加载配置文件并校验其 schema。
 * 返回对象与解析器的内部状态分离。
 *
 * @param path Path to the configuration file. 配置文件路径。
 * @returns A validated configuration. 已校验的配置。
 */
```

## Markdown localization layout

Markdown localization uses separate files by default. Keep one prose language per file:

```text
README.md
README.<locale>.md
docs/configuration.md
docs/configuration.<locale>.md
```

Follow an established locale directory convention when one exists. The English and localized files
must have equivalent headings, tables, links, examples, code blocks, conditions, and safety boundaries.
Do not copy the code-comment layout into Markdown by alternating English and localized paragraphs in
one file. Inline bilingual Markdown is an exception that requires an explicit repository or user rule.

## Markdown structure

Choose a page by reader intent rather than by source-tree shape:

| Reader need | Best surface |
| --- | --- |
| What is this and how do I start? | README or overview |
| How does the concept work? | Focused concept page |
| How do I perform a task? | Recipe or guide |
| How do I move from an old version? | Migration page or changelog |
| Why did this fail? | Troubleshooting page |

Keep each page focused. Link to adjacent pages instead of copying a contract. Use a stable heading
hierarchy, descriptive link text, fenced code blocks with the correct language, and examples whose
output or limitations are clear. Every human-facing page, section, example explanation, and changelog
entry must have a semantically equivalent English version followed by its localized-language version.

## Evidence and review

Trace claims to implementation, types, tests, configuration, or a named external authority. Mark an
assumption as such. Review the diff for stale API names, unsupported promises, missing links, examples
that no longer run, and text that accidentally becomes an instruction to an Agent. Once the localized
language is selected, compare both files for scope and safety—not only matching headings.
