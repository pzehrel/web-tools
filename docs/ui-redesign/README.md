# UI redesign: existing-function preservation baseline

> **Historical audit snapshot:** Coverage states and gaps below were recorded before the full-function expansion and do not describe the current F. Existing behavior and preservation criteria remain valid. See the [current full-function prototype](prototype-current.md) for the latest per-ID UI mapping and validation boundaries.
> [简体中文](README.zh-CN.md)

The redesigned UI must preserve the current product's complete user-visible capabilities. At this audit snapshot F was a partial, executable design study; its omissions do not reduce implementation scope. This inventory is the feature reference for subsequent UI design and implementation. Layout, component styling and labels can change; removing or narrowing an existing capability requires an explicit user decision.

## Audit boundary

- Date: 2026-10-18. Evidence: the **current working tree**, including pre-existing uncommitted product changes, rather than only Git HEAD `e182467682589cbebae36ed9954d2f0ac4449fd4`.
- Scope: six actual web tools, their entry routes and shared behavior. CSS shine and font toolkit remain hidden from the home directory but their direct routes remain part of the baseline. The old URL/QR routes are aliases, not additional tools.
- Coverage target: `?variant=F` at the audit snapshot before expansion. Rejected D/E variants, historical screenshots and merely reaching an old product page do not establish new-design coverage.
- Method: source audit of UI handlers, rendering branches, engines, records, shared hooks and prototype wiring. Earlier browser checks are distinguished in the chapters. This pass does not assert that every format, browser, error path or stored project was re-tested.
- Evidence identity: [source hashes](source-snapshot.json). [Machine-readable coverage](coverage.json) lists the same feature IDs and source-review statuses.

## Status definitions

| Status                             | Meaning                                                                                                          |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| C / covered / 已覆盖               | F implements the listed behavior in source. It is not final design approval or complete regression acceptance.   |
| P / partial / 部分覆盖             | Some actions work, but parameters, ranges, states, formats, persistence or interaction parity remain incomplete. |
| M / missing / not covered / 未覆盖 | F has no corresponding behavior. The existing product capability still has to be retained.                       |
| R / legacy-only / 仅旧页           | F links to the original product UI. The tool works there, but its UI redesign has not been delivered.            |

## Coverage overview

Counts are **feature groups**, not individual controls, a quality score or a percentage of implementation completion. Each row in a chapter includes the current behavior, actual F gap, source evidence and preservation acceptance.

| Tool / area                                          | Groups |   C |   P |   M |   R | Detailed inventory                |
| ---------------------------------------------------- | -----: | --: | --: | --: | --: | --------------------------------- |
| URL and QR code (registry name currently “链接解析”) |     25 |  22 |   1 |   2 |   0 | [U01–U25](features/url.md)        |
| Frame animation                                      |     20 |   1 |   8 |  11 |   0 | [F01–F20](features/motion.md)     |
| Nine-patch                                           |     29 |   2 |   9 |  18 |   0 | [N01–N29](features/nine.md)       |
| Lottie preview                                       |     20 |   0 |   0 |   0 |  20 | [L01–L20](features/motion.md)     |
| CSS shine (hidden)                                   |      9 |   0 |   0 |   9 |   0 | [C01–C09](features/hidden.md)     |
| Font toolkit (hidden)                                |     16 |   0 |   0 |  16 |   0 | [T01–T16](features/hidden.md)     |
| Shared site behavior                                 |      9 |   2 |   5 |   2 |   0 | [G01–G09](features/shared.md)     |
| Total                                                |    128 |  27 |  23 |  58 |  20 | 119 tool groups + 9 shared groups |

## The largest prototype gaps

- **URL / QR:** record actions are simulated in memory; durable records, old-data migration and hash sharing are absent. F defaults to the example instead of the product's initial empty state. Tree editing, variables, QR conversion and both download actions are already wired.
- **Frame animation:** ZIP/directory import, append/natural ordering, selection and drag order, transparent-edge crop, playback range/direction/finite loops, full FPS/duration controls, original-resolution configurable sprite grids, CSS/Less/SCSS generation and persistent project records are missing or narrowed. The product exports PNG sprites and animation code; this audit does not claim a GIF/video download feature.
- **Nine-patch:** actual slice-line drag/keyboard editing and image-relative constraints, automatic analysis, independent widths, outset, fill toggle, two-axis repeat, center crop/cropped PNG, independent preview pan/zoom, complete eight-direction resizing and records are not reproduced. The product already resizes previews; F's floating placement is a layout proposal, not a new baseline capability. The actual code generator currently exposes CSS longhand/shorthand, not an assumed Tailwind or active SCSS/Less exporter.
- **Lottie:** all 20 groups remain in the original UI: project import, two playback libraries/two renderers, playback/fit controls, atlas optimization and all options, animated-resource exclusion, resource comparisons, atlas view, optimized ZIP export and persistent project records.
- **CSS shine:** all four preview forms, masked image input, trigger/direction, five animation parameters, presets/replay/reset, CSS+HTML output/copy and reduced-motion behavior are outside F.
- **Font toolkit:** all import/preview/glyph inspection/health/subset/full-conversion/download flows are outside F. UI input supports TTF/OTF/WOFF/WOFF2; UI output supports WOFF2/WOFF/TTF. Engine types alone do not establish an OTF export workflow.
- **Shared:** system theme and durable preference, GitHub entry, legacy/dedicated route compatibility, project continuity, secondary canvas behavior and production SSG/SEO/web-app checks remain outside or only partly represented by F.

## Preservation and implementation acceptance

1. Each `U/F/N/L/C/T/G` ID gets an identifiable location and operation in the redesigned UI, including narrow-screen access. Consolidating panels or hiding advanced controls is allowed only when the complete capability remains reachable.
2. Import types, parameter meanings and useful ranges, multi-axis or multi-frame behavior, output formats, filename/content semantics, keyboard/touch paths and error/empty/busy states remain represented. A prototype constant or disabled/missing control is not a shipping specification.
3. Existing persisted records retain their tool identities, payloads, parameters and loading behavior. Storage/UI changes must verify older records and refresh/reopen behavior. Prototype memory records do not replace product data.
4. Implementation validation maps each ID to a reproducible check: UI location/state, representative input, operation and expected result. Export checks inspect resulting files/code, not only a click or toast. Viewing gestures must not alter exported parameters.
5. Before describing a tool as fully redesigned, resolve every partial/missing/legacy-only gap for that tool and verify its existing-function checks. A deliberate functional change is recorded separately with the user's explicit decision; an omitted prototype action is never such a decision.

Preserving capabilities does not require reproducing known defects or obsolete claims. For example, font output filename/code mismatches are recorded in the detailed audit, not endorsed as target behavior. Likewise, old nine-patch metadata/SEO wording is not proof of an active exporter. Fixes must retain the underlying workflow and be verified.

## Design boundary

The [design decision record](design-decisions.md) summarizes the reviewed direction. The remaining paragraph describes the earlier audit boundary. The user's requests for compact controls, visible canvases, floating parameters/preview and complete UI redesign remain active; F's exact palette and component choices are still proposals. The added flat “parsed results” panel is excluded, while the URL tree and its interactions remain protected. Removing promotional claims about device/local data does not remove data handling or compatibility capabilities.

This baseline is a repository document. This inventory task does not modify product UI, expand prototype functionality, publish a site or treat the overall redesign as approved.
