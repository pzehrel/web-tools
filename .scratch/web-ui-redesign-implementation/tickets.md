# Web UI redesign implementation tickets

> Migrated to GitHub Issues on 2026-10-20: [parent specification](https://github.com/pzehrel/web-tools/issues/1). This page and original local tickets remain migration snapshots of the same tasks; GitHub is authoritative for claiming and status, not a second work queue. Complete English/Chinese text, hierarchy and blocking edges were verified.

Status: ready-for-agent
Labels: ready-for-agent
Date: 2026-10-20
Canonical language: English

The user approved the granularity and dependencies of these 12 tickets with “可以” on 2026-10-20. Each ticket is published as a separate file with a complete Chinese translation; the language pair represents one task, not two.

[Chinese translation](tickets.zh-CN.md) · [implementation specification](spec.md) · [source index](sources.md) · [machine-readable dependencies and coverage](tickets.json)

## Tickets

| Number | Ticket                                                                                                    | Blocked by         | Status          |
| ------ | --------------------------------------------------------------------------------------------------------- | ------------------ | --------------- |
| 01     | [Home, navigation and production themes](issues/01-home-navigation-themes.md)                             | None               | ready-for-agent |
| 02     | [URL recursive editing and share-link round trip](issues/02-url-tree-sharing.md)                          | 01                 | ready-for-agent |
| 03     | [URL QR input, direct exports and durable records](issues/03-url-qr-records.md)                           | 02                 | ready-for-agent |
| 04     | [Frame import, full-width sequence and common-edge crop](issues/04-frames-import-sequence-crop.md)        | 01                 | ready-for-agent |
| 05     | [Frame playback, independent progress and canvas inspection](issues/05-frames-playback-canvas.md)         | 04                 | ready-for-agent |
| 06     | [Frame sprite/code export and complete project recovery](issues/06-frames-export-records.md)              | 05                 | ready-for-agent |
| 07     | [Lottie project import, playback and narrow task workspace](issues/07-lottie-import-playback.md)          | 01                 | ready-for-agent |
| 08     | [Lottie atlas optimization, inspected ZIP and project recovery](issues/08-lottie-atlas-export-records.md) | 07                 | ready-for-agent |
| 09     | [Nine-patch slicing, rendering and independent preview HUD](issues/09-nine-patch-editor-hud.md)           | 01                 | ready-for-agent |
| 10     | [Nine-patch automatic analysis, center crop and pixel export](issues/10-nine-patch-analysis-crop.md)      | 09                 | ready-for-agent |
| 11     | [Nine-patch CSS reuse and durable project recovery](issues/11-nine-patch-css-records.md)                  | 09                 | ready-for-agent |
| 12     | [Cross-tool production acceptance and prototype isolation](issues/12-production-acceptance.md)            | 03, 06, 08, 10, 11 | ready-for-agent |

## Frontier and acceptance

- Initially available: 01. Other tickets become available when their blockers are complete; `ready-for-agent` means specified for implementation, not unblocked or completed.
- After 01, tickets 02, 04, 07 and 09 can proceed independently. After 09, tickets 10 and 11 can proceed independently. Ticket 12 waits for every terminal workflow.
- All 103 existing feature groups and 12 UI decisions have exactly one primary owner plus cross-ticket checks. Production acceptance remains pending; every ticket has unchecked acceptance criteria.
- Verify input, editing, preview, export, records and refresh on real production pages while reusing existing module tests. Inspect actual exports; record tests isolate data while retaining production storage contracts.
- The proposal remains as approval history; this index and the separate published tickets supersede its publication state. The parent specification and prior planning records are unchanged. This action publishes tickets only; product implementation has not started.

## GitHub migration

| Local number | GitHub issue                                                                                                        | GitHub blockers      |
| ------------ | ------------------------------------------------------------------------------------------------------------------- | -------------------- |
| 01           | [#2 — Home, navigation and production themes](https://github.com/pzehrel/web-tools/issues/2)                        | None                 |
| 02           | [#3 — URL recursive editing and share-link round trip](https://github.com/pzehrel/web-tools/issues/3)               | #2                   |
| 03           | [#4 — URL QR input, direct exports and durable records](https://github.com/pzehrel/web-tools/issues/4)              | #3                   |
| 04           | [#5 — Frame import, full-width sequence and common-edge crop](https://github.com/pzehrel/web-tools/issues/5)        | #2                   |
| 05           | [#6 — Frame playback, independent progress and canvas inspection](https://github.com/pzehrel/web-tools/issues/6)    | #5                   |
| 06           | [#7 — Frame sprite/code export and complete project recovery](https://github.com/pzehrel/web-tools/issues/7)        | #6                   |
| 07           | [#8 — Lottie project import, playback and narrow task workspace](https://github.com/pzehrel/web-tools/issues/8)     | #2                   |
| 08           | [#9 — Lottie atlas optimization, inspected ZIP and project recovery](https://github.com/pzehrel/web-tools/issues/9) | #8                   |
| 09           | [#10 — Nine-patch slicing, rendering and independent preview HUD](https://github.com/pzehrel/web-tools/issues/10)   | #2                   |
| 10           | [#11 — Nine-patch automatic analysis, center crop and pixel export](https://github.com/pzehrel/web-tools/issues/11) | #10                  |
| 11           | [#12 — Nine-patch CSS reuse and durable project recovery](https://github.com/pzehrel/web-tools/issues/12)           | #10                  |
| 12           | [#13 — Cross-tool production acceptance and prototype isolation](https://github.com/pzehrel/web-tools/issues/13)    | #4, #7, #9, #11, #12 |
