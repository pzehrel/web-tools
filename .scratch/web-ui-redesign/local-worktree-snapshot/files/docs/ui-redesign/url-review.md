# URL / QR review and remaining gaps

> User decision on 2026-10-19: this layout revision was rejected because the preceding version looked better. The pre-review layout is restored: full-width input above the parameter tree and the QR/records column. The revision table below is historical; the feature-gap audit remains valid. The rejected component and SCSS are archived under `.scratch/web-ui-redesign/url-rejected-review.*`.

Reviewed on 2026-10-19 against the current product source, the [25 preservation groups](features/url.md) and the [current prototype mapping](prototype-current.md). This is a source audit and prototype revision, not browser acceptance.

## Self-review and revision

| Observation before revision                                                                   | Revised interface                                                                                                                                                     |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full-width input separated the tree from the QR column and consumed the top of both columns.  | Input and tree share the main editing column. A 264 px column keeps QR and records alongside them.                                                                    |
| Long trees and records shared page scrolling.                                                 | Desktop tree and record lists scroll independently. Mobile stacks the complete sections with bounded inner scrolling.                                                 |
| Clicking a QR image enlarged it while clicking its surrounding area opened image recognition. | A native button enlarges the QR. A separate labeled image-recognition button opens the picker; dropping and pasting images remain supported.                          |
| Root insertion was a small icon; original and serialized copying were hard to distinguish.    | Root insertion has a labeled tree-toolbar action. Input copying says “copy original”; root copying identifies the complete serialized URL. Nested row actions remain. |
| Variable code had no heading and its copy action was in the tree header.                      | The conditional code block has a heading and an adjacent copy action. Variable generation and encoding remain unchanged.                                              |
| QR recognition and export errors appeared by the text input.                                  | Those errors appear in the QR section with an alert role. Empty and plain-text tree states remain explicit.                                                           |

The recursive editable tree remains the primary structured view. No flat “parsing results” summary was added. Selected-record updating remains explicit; saving always creates a new snapshot. Native QR buttons also support Enter and Space.

## What is missing now?

| Scope                                        | Current finding                                                                                                                                                                                                            |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U01–U22, U24 and U25                         | Existing operations have interface entries and handlers. No additional missing baseline operation was found by this source audit. This is not proof of exhaustive runtime correctness.                                     |
| U23: records across refresh                  | Implemented in the isolated `web-tools-ui-PROTOTYPE-wipe-me` database. The historical audit's “in-memory only” description no longer describes the current prototype.                                                      |
| U23: production records and legacy migration | Still deferred. The prototype does not open production records or migrate old URL / QR localStorage entries. Keeping the original `url-parser` identity and migration compatibility is required for formal implementation. |
| U24: share hash                              | Current handlers restore `#url`, old `#text` and bare hashes, debounce replacement, and clear the hash when the input is empty. The historical missing status is obsolete for the current prototype.                       |
| U25: initial empty state                     | Current input starts empty; the example is an explicit action. Tree, text-only and QR empty states remain.                                                                                                                 |

Legacy migration is a deliberate prototype boundary, not permission to drop the feature. This revision does not access or migrate real user records.

## Evidence and limits

- The main state/effect/handler block is identical to the current product page and the saved pre-review prototype. Thirteen existing interaction components are unchanged, including inline editing, subtree drag/drop, record previews and the two download operations.
- All 67 original product-source hashes match the frozen snapshot. The UI changes are in the [prototype component](../../.scratch/web-ui-redesign/url-rejected-review.tsx) and its [SCSS](../../.scratch/web-ui-redesign/url-rejected-review.scss).
- All 37 existing parser/tree tests passed. Lint, type checking, production build and a separate in-memory build of the complete prototype passed. Targeted URL lint has zero errors and three inherited React warnings.
- Browser observation remains unavailable following the earlier browser security-policy denial. No alternative access was attempted. This revision has no new screenshots or live light/dark, pointer, keyboard, image-decode, export, storage or hash acceptance evidence. Source preservation and compilation do not replace those checks.

The original [coverage snapshot](coverage.json) remains historical and unchanged. This page records the new audit separately.
