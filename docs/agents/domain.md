# Domain documentation

## Layout

This repository uses application-scoped contexts with a root index. Paths below are relative to the repository root and describe the chosen locations, not a claim that every document already exists.

| Scope                     | Glossary                  | Architecture decisions  |
| ------------------------- | ------------------------- | ----------------------- |
| Index / cross-application | `GLOSSARY-MAP.md`         | `docs/adr/`             |
| Web application           | `apps/web/GLOSSARY.md`    | `apps/web/docs/adr/`    |
| Server application        | `apps/server/GLOSSARY.md` | `apps/server/docs/adr/` |

## Reading and writing rules

- Before domain exploration, read the root map if it exists, then the glossary for each relevant application. A cross-application change needs both contexts.
- Read relevant cross-application ADRs and the affected applications' ADRs before making an architectural proposal.
- If the map, glossary or ADR directory is absent, proceed silently. Do not create empty documents or upfront placeholders. Domain modeling creates the map, entries, glossaries and ADRs lazily when terminology or decisions are resolved.
- Use glossary terms consistently in tickets, hypotheses, proposals, tests and code-facing explanations. When a needed term is absent, check established project usage and note a real gap for domain modeling rather than inventing a competing synonym.
- If a proposal conflicts with an existing ADR, identify the ADR and explain why reopening it is justified; do not silently override it.
- Put application-specific decisions in that application's ADR directory and shared decisions in the root ADR directory. Keep the root map synchronized as application glossaries are created. Add contexts only when an application exists and a domain boundary is actually established.
- English documents are canonical, with separate faithful `.zh-CN.md` counterparts. Canonical maps and document links target canonical files; human-facing translations may link to their translated counterparts.
