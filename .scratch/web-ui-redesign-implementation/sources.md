# Specification source index

Date: 2026-10-20

This index supports the English specification and its Chinese translation. It contains source pointers, not implementation instructions. The specification is published in the configured local Markdown tracker with status `ready-for-agent`; this source index is not a second issue.

## Decisions and precedence

1. The user completed prototype review on 2026-10-20, requested hidden tool entries to remain hidden, and explicitly confirmed the product-page-first testing boundary during the to-spec step.
2. Use the latest reviewed behavior and [current prototype mapping](../../docs/ui-redesign/prototype-current.md), together with the retention criteria. The [visual-direction decision](../web-ui-redesign/issues/03-visual-direction.md#answer) records the accepted F direction and scope.
3. Preserve all 103 existing in-scope groups. The [historical baseline overview](../../docs/ui-redesign/README.md) and its detailed tables define behavior, not current prototype completion. F06 playback-following highlighting and U17 download-menu interaction are superseded only as explicitly specified.
4. Treat the [verification record](../../docs/ui-redesign/prototype-validation.json) as dated evidence with stated limits. It does not establish production-browser acceptance. The companion requirements manifest records coverage and pending acceptance rather than test success.

## Feature sources

| Specification IDs | Preservation source                                                                                                                                                                          |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G01–G09           | [Shared behavior](../../docs/ui-redesign/features/shared.md)                                                                                                                                 |
| U01–U25           | [URL and QR](../../docs/ui-redesign/features/url.md)                                                                                                                                         |
| F01–F20, L01–L20  | [Frame animation and Lottie](../../docs/ui-redesign/features/motion.md)                                                                                                                      |
| N01–N29           | [Nine-patch](../../docs/ui-redesign/features/nine.md)                                                                                                                                        |
| D01–D12           | [Current prototype](../../docs/ui-redesign/prototype-current.md), [color review](../../docs/ui-redesign/color-system.md), [review history](../web-ui-redesign/issues/03-visual-direction.md) |

## Accepted prototype references

- [Shared workspace, home and navigation](../../apps/web/src/ui-redesign-workspace.prototype.tsx)
- [Shared prototype styles](../../apps/web/src/ui-redesign.prototype.scss)
- [URL and QR](../../apps/web/src/ui-redesign-url.prototype.tsx)
- [Frame animation](../../apps/web/src/ui-redesign-frames-full.prototype.tsx)
- [Lottie](../../apps/web/src/ui-redesign-lottie-full.prototype.tsx)
- [Nine-patch](../../apps/web/src/ui-redesign-nine-full.prototype.tsx), [HUD](../../apps/web/src/ui-redesign-nine-hud.prototype.tsx) and [HUD geometry](../../apps/web/src/ui-redesign-hud-geometry.prototype.ts)
- [Central color tokens](../../apps/web/src/index.scss)

The [URL self-review](../../docs/ui-redesign/url-review.md) contains a rejected layout revision and explicitly records its rollback. That revision is historical; it does not override the subsequent equal-height top row and full-width tree/records decisions. The active prototype and chronological feedback take precedence over earlier screenshots.

## Existing test seams

- [URL parser and tree operations](../../apps/web/src/tools/url-parser/url-tree.test.ts)
- [Stage fitting and zoom](../../apps/web/src/lib/stage.test.ts)
- [Legacy-record conversion](../../apps/web/src/lib/storage/legacy.test.ts)
- [Frame archive round trips](../../apps/web/src/tools/frame-animation/records.test.ts)
- [Lottie archive](../../apps/web/src/tools/lottie-preview/records.test.ts), [assets](../../apps/web/src/tools/lottie-preview/lottie-assets.test.ts), [animated images](../../apps/web/src/tools/lottie-preview/image-animation.test.ts) and [metrics](../../apps/web/src/tools/lottie-preview/resource-metrics.test.ts)
- [Nine-patch slice bounds](../../apps/web/src/tools/nine-patch/slice-bounds.test.ts)

These are existing module seams. The confirmed primary acceptance seam is the real product page, covering user-visible workflows and real exports/records. No production browser acceptance suite was found in the current repository. Browser execution was unavailable during recent prototype rounds; the production acceptance matrix remains pending.

## Scope and planning history

The [decision map](../web-ui-redesign/map.md), [workflow baseline](../web-ui-redesign/issues/01-target-workflows.md#answer) and [navigation decision](../web-ui-redesign/issues/02-information-architecture.md#answer) retain the planning history. Later user decisions defer hidden tools and hide all their navigation entries. This specification synthesizes the workbench, shared-interaction and acceptance questions from that review and the confirmed test boundary; publishing it does not implicitly change the remaining planning-ticket statuses.

No production code is modified by this specification step. Task decomposition, implementation, prototype capture in version control and release actions remain separate steps with their existing scope constraints.
