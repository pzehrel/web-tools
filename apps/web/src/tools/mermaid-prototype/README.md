# Mermaid workflow prototype

Throwaway, memory-only UI prototype for [Mermaid editor: validate canvas and code workflows with a complex-graph prototype](https://github.com/pzehrel/web-tools/issues/21). Its question is whether canvas authoring, source editing, independent geometry, and one undo history form an understandable workflow. It is not the production tool or a complete Mermaid parser.

## Run

From this prototype worktree, run `pnpm prototype:mermaid` and open [the prototype](http://localhost:1421/tools/mermaid-prototype). Dependencies are recorded in the worktree lockfile; run `pnpm install --frozen-lockfile` first in a fresh checkout.

The current revision follows the user’s feedback: a full-viewport canvas with floating HUD controls. The top-left document menu contains import, reset and theme actions; top-right controls switch canvas/preview or open the code, properties and guided-scenario overlays. Selection/pan, shapes and layout float at the bottom; undo/redo and view controls sit separately. Opening an overlay preserves canvas dimensions and the viewing transform. Escape closes it.

The previous A/B/C arrangements were rejected. Their screenshots remain historical evidence; the current route ignores the old `variant` parameter. Closing overlays and switching canvas/preview preserve the document. Reloading, importing, choosing another example, or resetting a scenario starts a new session and discards the previous in-memory edits.

## Try

1. Open the help HUD to follow the four guided scenarios: normal round-trip, errors and unsupported syntax, grouping and comments, layout and conversion failure.
2. Drag a node, connect the small handles, double-click a label, or use the selected object's text field. Shift/Meta/Control allows multiple selection. Open the properties HUD and use the explicit group selector to change membership.
3. Compare the editing canvas with the Mermaid preview, then use undo/redo. Inspect the original source in the code HUD and diagnostic state in the help HUD to see what changed.

The group-dissolution dialog is a proposal awaiting user feedback: it offers removing edges attached to the dissolved group while retaining members, or cancelling. It never guesses which child should inherit an endpoint. Comment association uses a prototype heuristic; preserving comment text is checked, but universal comment ownership is not established.

## Evidence and limits

See [the observation record](../../../../../.scratch/mermaid-editor/prototype-observations.md) and [screenshots](../../../../../.scratch/mermaid-editor/evidence/). Browser interactions exercised real React Flow 12.12.0, elkjs 0.12.0, and Mermaid 12.2.0 in Chromium and Playwright WebKit. WebKit is not evidence of native Safari standalone or actual iOS-device acceptance.

The prototype uses Mermaid's pinned **internal FlowDB** for source-to-graph experiments, a semantic comparison before committing generated source, and a simple comment-association heuristic. It does not establish a stable public AST or arbitrary-source round-trip fidelity. ELK computes nested node positions with cross-group edges projected between sibling containers; displayed edge curves are custom and do **not** provide obstacle avoidance. No package-size optimization, Web Worker layout integration, full accessibility audit, actual IME/device validation, image export, or project persistence is included. These limits remain explicit follow-up work; the decision ticket stays open until human review.

The route and route ID exist only on `prototype/mermaid-workflow`; there is no public tool-registry entry or sitemap change. Rewrite validated behavior for production rather than merging this prototype wholesale.

[简体中文](README.zh-CN.md)
