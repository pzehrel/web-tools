# Implementation ticket proposal

Status: draft — awaiting breakdown approval
Date: 2026-10-20
Canonical language: English

This proposes 12 implementation tickets for the [approved specification](spec.md). It does not publish agent-ready tickets or authorize implementation. The [Chinese translation](ticket-proposal.zh-CN.md) has the same scope and dependencies. Stable implementation references remain in the [source index](sources.md).

## Rules shared by every ticket

- Preserve all behavior in the assigned requirement IDs, including defaults, bounds, edge cases and failure handling in the specification. These summaries do not replace its detailed contracts. Reuse the production engines and storage contracts; prototype coverage is not production acceptance.
- Each ticket changes a complete real-page workflow and verifies that workflow. Existing controls outside its scope remain available during migration. Any necessary component extraction stays within that ticket and preserves behavior; no separate engine rewrite or infrastructure-only phase is proposed.
- Each workflow includes its applicable light/dark states, compact desktop layout, keyboard/focus behavior, phone core operation, empty/busy/error feedback and relevant existing module tests. Export tickets inspect decoded output or archive contents. Record tickets use isolated test data with production identities and verify reload and older records.
- Follow reviewed borderless icon actions, semantic colors and floating-workspace decisions. Keep hidden tool entries hidden and retain direct routes. Do not add promotional data-location claims.
- Run the required lint, typecheck and build checks for each implementation. Record real product-page evidence; unavailable browser checks remain pending and cannot be replaced by source inspection. Preserve unrelated changes and prototype references. No commit, release or deployment is included.

## Proposed tickets

### 01 — Home, navigation and production themes

**Blocked by:** None (can start immediately).

**Delivers:** Enter any public tool from the reviewed compact home, return on the left, switch tools, open the correct GitHub link and retain system/light/dark preferences on real routes.

**Primary requirements:** G01–G05, G08–G09, D01–D04. Canvas-specific adoption of D01–D02 is also required in tickets 05, 07 and 09.

**Acceptance focus:** Four public entries only; retained redirects, hidden direct routes and fallback; correct menu/modal stacking; equal square theme controls; production blue/semantic palette without a development gate; readable feedback and focus; single hydrated page with correct metadata, manifest and Safari behavior. Reconcile production design guidance with approved decisions. Existing tool functionality remains usable while its workspace awaits migration.

### 02 — URL recursive editing and share-link round trip

**Blocked by:** 01 — Home, navigation and production themes.

**Delivers:** Open an empty or shared URL, inspect and edit every nested level, move/add/delete nodes, copy original or serialized values and generate variable templates in the approved layout.

**Primary requirements:** U01–U10, U24–U25, D05–D06.

**Acceptance focus:** Equal-height input/centered-QR first row, full-width compact-item tree then records; retain QR and record controls while ticket 03 migrates them. Verify malformed escapes, duplicate/empty/flag fields, nested hash routes, base suffix preservation, inline submit/cancel/focus, all insert/drop targets and rejection, confirmed deletion, depth-correct variable encoding and copying. Current/legacy/bare share hashes restore, editing replaces history after debounce and clearing removes the share hash. Example remains explicit.

### 03 — URL QR input, direct exports and durable records

**Blocked by:** 02 — URL recursive editing and share-link round trip.

**Delivers:** Generate or recognize a QR, inspect its enlarged tree preview, download the intended image directly, save/update/preview records and resume old work after refresh.

**Primary requirements:** U11–U23.

**Acceptance focus:** Debounce, stale-result protection, picker/drop/paste guards and distinct recognition failures; page downloads pure QR, dialog downloads QR plus parameters with plain-text fallback, with no dropdown. Decode QR and inspect combined-image dimensions/wrapping/omission and retry/busy behavior. Verify explicit save versus update, naming/renaming, preview-before-selection, deselection, copy, confirmed delete/clear and selection cleanup. Retain the original URL record identity, legacy conversion and nonblocking read-error behavior.

### 04 — Frame import, full-width sequence and common-edge crop

**Blocked by:** 01 — Home, navigation and production themes.

**Delivers:** Import images, ZIP or directory, organize and select the full-width bottom sequence, crop shared transparent edges and clear or replace materials without losing sequence rules.

**Primary requirements:** F01–F07, F19. Introduces the sequence portion of D07; ticket 05 completes and verifies the progress/sequence arrangement.

**Acceptance focus:** Valid-image filtering, archive filtering, source metadata, naturally sorted appended batches and explicit global sort; manual order survives later imports. Verify before/after drag, all/none and per-frame selection, stable selection feedback with no playback-following highlight, stacked crop preview, live alpha limits, mixed-size warning, cancel/apply and result pixels. Clearing stops playback and resets dependent states. Existing playback/export/record actions remain reachable.

### 05 — Frame playback, independent progress and canvas inspection

**Blocked by:** 04 — Frame import, full-width sequence and common-edge crop.

**Delivers:** Inspect selected frames on the visible canvas, seek with the short progress control above the sequence, configure timing/range/direction/loops and resume predictable playback.

**Primary requirements:** F08–F14, D07–D08; adopts D01–D02.

**Acceptance focus:** Narrow left panel stops above the full-width bottom sequence; collapsing the sequence releases canvas space. Seeking pauses without changing selection or export/playback range; resume obeys that range and finite playback restarts correctly. Verify stepping, thumbnail seeking, guarded shortcuts, FPS/duration/fractional timing, inclusive range clamping, forward/reverse/ping-pong, fit/pan/pinch/reset, view-only backgrounds/boundaries and pixel rendering. Reuse stage tests and verify on the real page.

### 06 — Frame sprite/code export and complete project recovery

**Blocked by:** 05 — Frame playback, independent progress and canvas inspection.

**Delivers:** Turn the edited sequence into the correct sprite PNG and CSS/Less/SCSS, then save and restore the complete project through refresh.

**Primary requirements:** F15–F18, F20. Operation feedback is also checked in tickets 04–05.

**Acceptance focus:** Linked grid controls, actual output preview/metrics, source-max cell dimensions and centered smaller frames; inspect exported pixels. Generated code preserves selected range, timing, direction, loops, pixel style, variables and relative sizing, with copy feedback and code-only select-all. Verify archived bytes/order/selection/crop threshold/playback/export settings, naming/load/delete, older records and empty/busy/failure recovery using existing archive tests and real-page workflows.

### 07 — Lottie project import, playback and narrow task workspace

**Blocked by:** 01 — Home, navigation and production themes.

**Delivers:** Import a supported project, inspect its animation using all existing engine/render/fitting choices, seek precisely and access messages in the reviewed narrow-left workspace.

**Primary requirements:** L01–L09, L19–L20, D10; adopts D01–D02. Establishes the task-tab layout of D09 while retaining existing optimization, comparison, export and record access until ticket 08 completes their migration.

**Acceptance focus:** Single ZIP or full directory with exactly one valid data.json; nested/relative/embedded image resolution, missing/unreadable warnings and no automatic remote image fetching. Preserve replacement/example/clear resets, both libraries, canvas/SVG, meet/slice, fractional progress, speed/direction/loop and main-stage gestures. Unify import/metadata/view controls, keep playback short, place material messages in the left footer with warning/error expansion and phone access. Verify wrapping, touch and scrollable messages, not only successful import.

### 08 — Lottie atlas optimization, inspected ZIP and project recovery

**Blocked by:** 07 — Lottie project import, playback and narrow task workspace.

**Delivers:** Optimize a real project, inspect independent floating atlases and before/after resource metrics, export a usable ZIP and restore the complete saved project.

**Primary requirements:** L10–L18, D09. Completes atlas behavior in D10 and all related L19–L20 states.

**Acceptance focus:** Optimization/playback/project-record tabs with comparison and export always reachable. Retain every packing option/default/bound, rebuild toggle and valid-original fallback, animated-image exclusions, increases and detailed metrics. Inspect multiple atlases with independent gestures/reset. Unzip output to verify rewritten references, atlas PNGs and required original/embedded assets. Verify named durable complete projects and settings, old-record compatibility, load/delete and asynchronous failure recovery. Reuse asset, animation-detection, metrics and record-archive tests; no new optimizer or storage format is required.

### 09 — Nine-patch slicing, rendering and independent preview HUD

**Blocked by:** 01 — Home, navigation and production themes.

**Delivers:** Load a source, adjust slices numerically/by pointer/by keyboard, inspect live border rendering and move/resize its floating HUD without changing output dimensions accidentally.

**Primary requirements:** N01–N09, N11–N14, N18–N23, D11–D12; adopts D01–D02. Ticket 10 verifies the high-position center-crop part of D11.

**Acceptance focus:** Import cancellation/type/decode recovery, normal example/default/clear paths, normalized noncrossing slices and targeted slice reset. Preserve bound/unbound widths, outset, fill and both repeat axes. Verify eight inner logical resize handles versus eight outer HUD handles, separate dimensions/positions, keyboard steps, zoom conversion, fixed anchors, viewport bounds and pointer cleanup. Source/preview/HUD resets remain distinct; fit/manual takeover and view-only backgrounds work. Keep center-crop controls high and existing output/records available during migration.

### 10 — Nine-patch automatic analysis, center crop and pixel export

**Blocked by:** 09 — Nine-patch slicing, rendering and independent preview HUD.

**Delivers:** Analyze slices automatically, refine frequent center cropping with visible kept/removed areas and download the precise cropped PNG.

**Primary requirements:** N10, N15–N17; completes the center-crop portion of D11.

**Acceptance focus:** Analysis normalizes slices/widths/minimum crop, reports busy/result/error and permits manual refinement. Both/X/Y axes, bounded retained dimensions, minimum action, overlay explanations and repeat warnings remain. Decode exported PNG to verify 1:1 corners/retained rows/columns, dimensions and naming; disable ineffective crop, preserve numeric CSS slices and keep live border-image preview based on the original source.

### 11 — Nine-patch CSS reuse and durable project recovery

**Blocked by:** 09 — Nine-patch slicing, rendering and independent preview HUD.

**Delivers:** Copy accurate longhand/shorthand CSS and save, reload or delete complete nine-patch projects, including older incomplete records.

**Primary requirements:** N24–N29.

**Acceptance focus:** Compact four-side values, image path guidance, widths/outset/fill/repeat axes, copy success and code-only select-all. Restore original source bytes plus slice/render/crop/code-writing settings with normalization and record names/sizes; empty save is disabled. Targeted deletion preserves the current editor and other records. HUD/view geometry is not stored or exported. Ticket 10 is not a blocker: existing crop parameters and durable contracts remain usable throughout; ticket 12 verifies their combined finished interfaces.

### 12 — Cross-tool production acceptance and prototype isolation

**Blocked by:** 03 — URL QR input, direct exports and durable records; 06 — Frame sprite/code export and complete project recovery; 08 — Lottie atlas optimization, inspected ZIP and project recovery; 10 — Nine-patch automatic analysis, center crop and pixel export; 11 — Nine-patch CSS reuse and durable project recovery.

**Delivers:** A consistent production journey from home through all four tools and back, with saved work preserved and no prototype/runtime dependency in the shipped interface.

**Primary requirements:** G06–G07. Integration acceptance covers all 115 requirement IDs, with ticket-level evidence reused rather than repeated wholesale.

**Acceptance focus:** Close every requirement's production acceptance entry with evidence or a blocking unresolved result. Verify cross-tool menus/modal/HUD stacking, system/light/dark, wide/compact desktop and approximately 390/320-pixel phone core tasks, keyboard input guards and touch. Check production SSG hydration/metadata, legacy links/records and Safari assets together. Prove no variant switcher, prototype database or development-only palette dependency in production; preserve design references and hidden direct routes. Run lint/typecheck/build after integration. Actual product browser evidence remains required; deployment is outside scope.

## Dependency rationale and coverage

Ticket 01 is the only common prerequisite: it establishes the production navigation/theme contract on real routes. URL, frame, Lottie and nine-patch work can then proceed independently. Within each tool, later workflows depend on their actual editing/import workspace. Nine-patch crop and CSS/records can proceed independently after ticket 09. Ticket 12 lists only terminal blockers; their prerequisites are transitively required.

The [machine-readable proposal](ticket-proposal.json) assigns each of the 103 existing feature groups and 12 reviewed UI decisions exactly one primary owner and records additional cross-ticket checks. Assignment is planning coverage, not proof of passed acceptance. No separate prefactoring ticket is justified: engines, archives and storage already exist; extracting an adapter or component can accompany its first working workflow.

## Review questions

1. Does this 12-ticket granularity feel right, or are any slices too large or too small?
2. Do these dependencies represent genuine blockers, especially the common first ticket and independent nine-patch branches?
3. Should any tickets be merged or split before publication?

After approval, publish one file per ticket with the `ready-for-agent` status, plus a complete Chinese translation. This draft and the parent specification are not implementation completion records.
