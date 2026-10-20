# 05: Frame playback, independent progress and canvas inspection

**What to build:** Inspect selected frames on the visible canvas, seek with the short progress control above the sequence, configure timing/range/direction/loops and resume predictable playback.

**Blocked by:** [04 — Frame import, full-width sequence and common-edge crop](04-frames-import-sequence-crop.md)

**Status:** ready-for-agent

**Labels:** ready-for-agent

**Approval:** 2026-10-20 — human user: 可以

Context: [full specification](../spec.md); [source index](../sources.md); [ticket index](../tickets.md); [Chinese translation](05-frames-playback-canvas.zh-CN.md).

**Primary requirements:** F08–F14, D07–D08; adopts D01–D02.

## Acceptance criteria

- [ ] Narrow left panel stops above the full-width bottom sequence; collapsing the sequence releases canvas space.
- [ ] Seeking pauses without changing selection or export/playback range; resume obeys that range and finite playback restarts correctly.
- [ ] Verify stepping, thumbnail seeking, guarded shortcuts, FPS/duration/fractional timing, inclusive range clamping, forward/reverse/ping-pong, fit/pan/pinch/reset, view-only backgrounds/boundaries and pixel rendering.
- [ ] Reuse stage tests and verify on the real page.

## Requirement acceptance checklist

- [ ] **F08** — As a designer, I want playback, pause, stepping, selected-thumbnail seeking and existing keyboard controls with text-input guards and crop-dialog Escape, so that navigation remains efficient.
- [ ] **F09** — As a designer, I want the existing FPS and duration relationship, fractional inference and timing displays, so that preview and exported timing stay consistent.
- [ ] **F10** — As a designer, I want an inclusive start/end range with a full-range reset and selection-aware clamping, so that playback and export use the intended frames.
- [ ] **F11** — As a designer, I want forward, reverse and ping-pong playback with infinite or finite loops and restart after completion, so that playback and code preserve the chosen behavior.
- [ ] **F12** — As a designer, I want automatic source-size fitting, zoom/pinch, pan, scale feedback and reset, so that small and large frames remain inspectable.
- [ ] **F13** — As a designer, I want boundary and themed checker/solid viewing backgrounds, so that I can inspect transparency without changing output pixels.
- [ ] **F14** — As a designer, I want the pixel-art option reflected in previews and generated styling, so that pixelated material retains its intended rendering.
- [ ] **D07** — As a frame-animation user, I want the frame sequence across the entire bottom edge and a short progress control above it, so that the canvas retains useful space.
- [ ] **D08** — As a frame-animation user, I want progress seeking independently of thumbnail selection and no playback-following thumbnail highlight, so that editing the sequence stays visually stable.

## Cross-ticket checks

- [ ] D01, D02, G07, F20

## Execution and verification constraints

- [ ] Preserve all behavior in the assigned requirement IDs, including defaults, bounds, edge cases and failure handling in the specification. These summaries do not replace its detailed contracts. Reuse the production engines and storage contracts; prototype coverage is not production acceptance.
- [ ] Each ticket changes a complete real-page workflow and verifies that workflow. Existing controls outside its scope remain available during migration. Any necessary component extraction stays within that ticket and preserves behavior; no separate engine rewrite or infrastructure-only phase is proposed.
- [ ] Each workflow includes its applicable light/dark states, compact desktop layout, keyboard/focus behavior, phone core operation, empty/busy/error feedback and relevant existing module tests. Export tickets inspect decoded output or archive contents. Record tickets use isolated test data with production identities and verify reload and older records.
- [ ] Follow reviewed borderless icon actions, semantic colors and floating-workspace decisions. Keep hidden tool entries hidden and retain direct routes. Do not add promotional data-location claims.
- [ ] Run the required lint, typecheck and build checks for each implementation. Record real product-page evidence; unavailable browser checks remain pending and cannot be replaced by source inspection. Preserve unrelated changes and prototype references. No commit, release or deployment is included.
