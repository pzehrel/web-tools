# Mermaid workflow prototype observations

Date: 2026-10-22 (Asia/Shanghai). Decision: [Mermaid editor: validate canvas and code workflows with a complex-graph prototype](https://github.com/pzehrel/web-tools/issues/21). Source branch: `prototype/mermaid-workflow`. **The user rejected the first arrangements and requested a full-screen canvas with HUD. The revised artifact still awaits human acceptance; the decision ticket remains open.**

## Artifact

Run `pnpm prototype:mermaid` in the prototype worktree. Open `http://localhost:1421/tools/mermaid-prototype`. The current revision is a full-viewport canvas with floating HUD controls and on-demand code/properties/help overlays. Old `variant=A/B/C` links now show this revision. [Instructions and limitations](../../apps/web/src/tools/mermaid-prototype/README.md).

The default fixture contains 11 graph objects, including three nested/group containers, and 12 connections. It includes a condition, cycle, self-loop, parallel connections, cross-group links, a group-to-group connection, and an ordinary comment. The browser really runs React Flow 12.12.0, elkjs 0.12.0 and Mermaid 12.2.0.

## Full-screen HUD revision

User feedback: “原型不太行，要全屏画布+hud的模式。” The prior A/B/C arrangements are rejected, rather than accepted as a baseline. The canvas now owns the viewport; document, view, history and shape controls float around its edges. Code and properties overlay the canvas without resizing it. The shared site header is hidden only while this prototype is mounted; the HUD retains return, import and theme actions.

Browser exercises on the revised artifact established:

- Chromium at 1440×900: the canvas rectangle is exactly `(0, 0, 1440, 900)`. Opening the code HUD leaves both that rectangle and the database node’s screen rectangle unchanged; Escape closes the HUD.
- Dragging the database node preserves source text; one undo restores the exact original node style/geometry. The pan tool changes the viewport transform while undo/redo counts stay unchanged. Adding a rectangle through the HUD and renaming it through properties both update the graph.
- Light/dark controls and the code copy entry remain available. Mermaid SVG appears in the preview alongside the code overlay.
- Playwright WebKit at 390×844: the canvas rectangle is exactly `(0, 0, 390, 844)`. The code HUD is `(10, 108, 370, 624)`, with no document overflow and no viewing-transform change when opened; all 11 graph objects remain present.
- Invalid code stays in the HUD, the retained preview is labelled as the previous valid source, and undo restores the original source and visual-editing mode.
- WebKit’s native button appearance initially obscured dark HUD colors; scoped `appearance: none` corrected it. One startup development warning claimed React Flow styles were absent; the loaded pane has the required computed `z-index: 1` and the graph renders. This observation does not establish native Safari/device acceptance.

`pnpm lint`, `pnpm typecheck` and `pnpm build` pass. Lint has 21 warnings: 20 in existing code and one for inserting the prototype’s Mermaid SVG. This revision introduces no prototype test files.

## Initial revision browser observations

These are scripted manual browser exercises, not new automated test files or a production acceptance suite.

| Exercise | Observed result |
| --- | --- |
| Initial graph | All 11 objects and 12 connections appeared; all three layout variants loaded. |
| First canvas label edit | A normalization dialog appeared. Accepting generated valid source, changed the label, and retained the comment. |
| Drag and undo | Dragging the root database node changed its geometry but left source text identical; one undo restored its exact previous coordinates. |
| Drag a connection | Job-to-database handle dragging added a third parallel connection; total connection count became 13, and the ordinary comment remained. |
| Unsupported syntax | Valid `classDef` input entered code-and-preview mode, preserving input and disabling canvas editing. |
| Invalid source | An unclosed subgraph retained the entire draft, showed the Mermaid parse error, and labelled the retained preview as the previous valid code. |
| Undo and redo across invalid input | Undo restored the earlier source; redo retained the exact invalid draft. Continuous typing can group into one history step. |
| Return from unsupported syntax | Removing the unsupported construct restored visual editing; per-object geometry values were unchanged. Object-key order is not a layout change. |
| Rapid successive edits | The visible Job label matched the final input, rather than the earlier text. This is a bounded exercise, not proof of every asynchronous race. |
| Reparent and undo | Explicitly moving App into CORE retained 12 connections and the comment; undo returned its parent to CLIENT. |
| Group dissolution warning | CLIENT has a group-endpoint connection. The dialog offered cancelling or deleting that endpoint connection while keeping members. This proposal still needs human agreement. |
| Injected conversion failure | A real failure injected after candidate conversion but before commit left source, graph, and history unchanged. |
| WebKit | Playwright WebKit loaded the graph and produced a Mermaid SVG. This does not establish native Safari web-app behavior. |
| Phone-width WebKit | At 390×844, the dark layout had 11 canvas objects and no document-level horizontal overflow. This is viewport evidence, not a physical touch-device check. |

## Screenshots

Current HUD revision:

- [Full-screen canvas: light desktop](evidence/hud-desktop-light.png)
- [Code overlay: light desktop](evidence/hud-code-desktop-light.png)
- [Full-screen canvas: dark desktop](evidence/hud-desktop-dark.png)
- [Preview and code: dark desktop](evidence/hud-preview-desktop-dark.png)
- [Full-screen canvas: dark phone-width WebKit](evidence/hud-webkit-mobile-dark.png)
- [Code overlay: dark phone-width WebKit](evidence/hud-code-webkit-mobile-dark.png)

Rejected initial arrangements, retained as history:


- [A: canvas first](evidence/variant-A-desktop-light.png)
- [B: code beside canvas](evidence/variant-B-desktop-light.png)
- [C: guided workspace](evidence/variant-C-desktop-light.png)
- [C: dark theme](evidence/variant-C-desktop-dark.png)
- [WebKit: phone-width dark theme](evidence/webkit-mobile-dark.png)

## Explicit limits and questions

- Source import uses the pinned internal FlowDB, not a stable public AST. The semantic comparison and ordinary-comment retention are demonstrated on this fixture, not proven for arbitrary Mermaid input, repeated declarations, every style, or every comment placement.
- ELK lays out sibling containers recursively, projecting cross-group edges. Canvas curves are simplified and have no obstacle avoidance. This artifact does not establish routing quality for the complete accepted scope.
- The layout engine currently runs on the main thread. The displayed duration is a single local layout observation, not a graph-size budget or a latency guarantee.
- An initial production build emitted a roughly 2.31 MB editor chunk (about 670 kB gzip) and a separate roughly 1.48 MB ELK chunk (about 454 kB gzip), alongside other assets. These are individual output observations, not a summed cold-load budget or an optimized shipping design.
- Native Safari standalone, real iOS/touch operation, physical IME composition, full keyboard accessibility/focus trapping, sustained large graphs, and exhaustive race/security checks remain unverified.
- Project persistence and image export are not implemented. Refreshing or loading another fixture discards in-memory changes; view switching alone preserves them.

Human review should assess the revised full-screen HUD arrangement, whether the code/canvas distinction is clear, and group-endpoint deletion and comment association. Findings may require reopening the selected route; the prototype is not permission to reduce the accepted scope silently.

[简体中文](prototype-observations.zh-CN.md)
