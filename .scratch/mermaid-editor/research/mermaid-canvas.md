# Mermaid editor: canvas, layout, and reference-product evidence

Research date: **2026-10-20** (Asia/Shanghai). Repository baseline: `e182467682589cbebae36ed9954d2f0ac4449fd4`.

Question: [Mermaid 编辑器：研究画布引擎、布局与参照产品的适配性](https://github.com/pzehrel/web-tools/issues/17). Parent: [Mermaid 交互编辑器：首版规格与技术路线决策地图](https://github.com/pzehrel/web-tools/issues/15).

This is bounded decision evidence, not an engine selection or implementation specification. The agreed starting scope is an interaction-first flowchart/architecture editor, including groups, conditional branches, loops and cross-group edges; original imported source must survive unsupported syntax. Dedicated Mermaid parser and round-trip research is tracked separately.

Evidence labels: **Verified** means supported by the linked first-party material or inspected source; **Inference** means a consequence proposed for evaluation; **Unknown** means not demonstrated here. Documentation describes upstream capabilities, not a tested integration with this application. No package was installed and no runtime, browser or bundle benchmark was performed.

## 1. The layout promise must be decided separately

| Layer | Examples | Evidence and consequence |
| --- | --- | --- |
| Graph semantics | Node IDs, labels, shapes, directed edges, subgraph membership | **Verified:** Mermaid flowchart syntax expresses these, including edges entering/leaving subgraphs. **Inference:** these are candidates for portable code generation. |
| Layout intent | Diagram/subgraph direction, link rank span, layout algorithm, curve style | **Verified:** flowchart documentation describes ranks and minimum link length, rather than pixel positioning. It also warns that an external connection from a subgraph child can make that subgraph inherit its parent's direction. |
| Editor geometry | Node x/y, dimensions, edge waypoints, preferred ports | **Verified:** React Flow and maxGraph expose geometry in their own models. **Inference:** those models do not establish a Mermaid source contract. |
| View state | Zoom, pan, selection, focused group | **Inference:** this state can be persisted separately; it is not equivalent to changing graph meaning or standard Mermaid layout. |

Sources: [Mermaid flowchart syntax](https://mermaid.js.org/syntax/flowchart.html), [React Flow subflows](https://reactflow.dev/learn/layouting/sub-flows), [maxGraph Geometry](https://maxgraph.github.io/maxGraph/api-docs/classes/Geometry.html).

**Verified from the companion source investigation:** Mermaid 12.2.0's public `FlowVertex`/`FlowEdge` types have no free x/y or edge-control-point fields; `FlowVertex.pos` denotes an image/icon label position, not canvas coordinates. [Pinned flowchart types](https://github.com/mermaid-js/mermaid/blob/1fb7869866dd619168d840291c9c54b4f129758b/packages/mermaid/src/diagrams/flowchart/types.ts). **Unknown / do not promise:** arbitrary free coordinates and bend points surviving a standard flowchart-code export and an unrelated renderer. The reviewed public Mermaid syntax/layout docs do not establish that contract. This is narrower than claiming that every Mermaid diagram language lacks all positioning features; other diagram types have different grammars.

**Verified, version-sensitive:** the current layout documentation identifies itself as Mermaid **12.2.0**, says ELK is bundled and the default from v12, and allows selecting Dagre. This differs from older v11 integration assumptions. **Inference:** pin a Mermaid version and explicitly define rendering expectations; choosing ELK in two different renderers is insufficient evidence of identical output. [Mermaid layouts](https://mermaid.js.org/config/layouts.html).

## 2. Finite candidate comparison

The candidates cover a node/edge component, direct Mermaid SVG, and two general diagram/whiteboard engines. No candidate automatically supplies lossless bidirectional Mermaid editing.

### React Flow / xyflow

**Verified:** `@xyflow/react` source package **12.12.0** declares MIT and React/React DOM `>=17`; React 19 is inside that peer range. Dependencies include `@xyflow/system`, `classcat`, and Zustand. This is a source snapshot, not a claim that the workspace has installed it. [Pinned package manifest](https://github.com/xyflow/xyflow/blob/654ba5a5e04f3404bc4db2eee88bfa15866d203d/packages/react/package.json), [license](https://github.com/xyflow/xyflow/blob/654ba5a5e04f3404bc4db2eee88bfa15866d203d/LICENSE).

- **Verified:** node dragging, handle connections, box/multiple selection, zoom/pinch and configurable keyboard bindings are documented. Inline text editing would be application UI in custom nodes. Keyboard navigation, selection, deletion and node movement are documented; connector creation accessibility still needs the intended UX evaluated. [Component API](https://reactflow.dev/api-reference/react-flow), [accessibility](https://reactflow.dev/learn/advanced-use/accessibility).
- **Verified:** nested nodes use `parentId` and parent-relative positions. Parent nodes must precede children; `extent: 'parent'` constrains dragging. Children can connect outside their parent. Edges involving child nodes have special stacking behavior. **Inference:** nesting and cross-group semantics are feasible, but drag-to-reparent, group resizing, and collision rules remain application work. [Subflows](https://reactflow.dev/learn/layouting/sub-flows).
- **Verified:** `toObject()` or controlled nodes/edges can save and restore state. **Inference:** preserve semantic IDs and layout separately from transient selection. [Save and restore](https://reactflow.dev/examples/interaction/save-and-restore).
- **Verified:** the published undo/redo and draggable edge-control-point examples are **Pro example source**, under the xyflow Pro license. This is not evidence that undo or custom routing requires a paid runtime: an application may implement its own behavior using the MIT component. History must also cover source edits and group changes, not only node positions. [Undo/redo example](https://reactflow.dev/examples/interaction/undo-redo), [editable edges](https://reactflow.dev/examples/edges/editable-edge).

**Verified:** React Flow delegates automatic layout to external libraries. Its comparison flags a Dagre limitation for subflows whose nodes connect outside the group; it lists ELK as supporting subflows and edge routing. **Inference:** simple-tree demos cannot establish this requirement's nested/cyclic routing quality. [Layout overview](https://reactflow.dev/learn/layouting/layouting).

### Direct Mermaid SVG plus an interaction overlay

**Verified:** `mermaid.render` returns SVG and a function for binding defined tooltip/click interactions after insertion. The documented API is a rendering and event-binding surface; it does not document a full node-drag/edge-authoring/history editor. [Mermaid API usage](https://mermaid.js.org/config/usage.html).

**Inference:** selection overlays and property editing can keep the official renderer as the visible preview. Free dragging requires either temporary display transforms or an additional layout model/renderer. Moving a node's SVG transform alone does not recompute the graph's edge routes, labels or containing subgraph geometry. Re-rendering after semantic changes must deliberately reconcile selection and geometry. Building hit testing, multiline editing, box selection, connection gestures and history is substantial editor work.

**Unknown:** stability of generated SVG element identifiers/classes as an editor integration contract across selected versions and diagram types. No source-to-SVG-to-source fidelity or accessible editor behavior was demonstrated here. This approach avoids an additional canvas engine, but still loads Mermaid and any required layout code; it is not proven to be the smallest complete implementation.

### maxGraph

**Verified:** inspected `@maxgraph/core` source **0.25.0** declares Apache-2.0, ESM/CJS exports, CSS side effects, and no runtime dependencies. It is framework-agnostic, using SVG/HTML. **Inference:** React owns the mounting/cleanup boundary and synchronization adapter; this is not a React component with a peer-dependency compatibility guarantee. [Pinned manifest](https://github.com/maxGraph/maxGraph/blob/b2cac2e6894d40ee161d7f9944ca639cfe2b86ba/packages/core/package.json), [license](https://github.com/maxGraph/maxGraph/blob/b2cac2e6894d40ee161d7f9944ca639cfe2b86ba/LICENSE), [upstream README](https://github.com/maxGraph/maxGraph).

- **Verified:** official docs describe move/resize/rotate, in-place labels, drag connections, rubberband/multiple selection, keyboard shortcuts, routing styles, hierarchical groups, folding and several built-in layouts. **Inference:** the drawing primitives align with a draw.io-like editing experience, but the exact nested cross-group/cycle routing cases still need a prototype. [Introduction](https://maxgraph.github.io/maxGraph/docs/intro/), [group structure](https://maxgraph.github.io/maxGraph/docs/manual/group-and-complexity-management/).
- **Verified:** geometry includes node x/y and edge control points; edge styles may interpret or ignore control points, and reset-on-move/resize behavior is configurable. [Geometry](https://maxgraph.github.io/maxGraph/api-docs/classes/Geometry.html).
- **Verified:** UndoManager records model transactions and can include view-root changes. The model/view listeners must be installed. XML serialization is available. **Inference:** source preservation, Mermaid export and coherent history across code and canvas still need an adapter. [UndoManager](https://maxgraph.github.io/maxGraph/api-docs/classes/UndoManager.html), [Editor](https://maxgraph.github.io/maxGraph/api-docs/classes/Editor.html).

### tldraw

**Verified:** inspected SDK source **5.5.2** requires React/React DOM `^18.2.0 || ^19.2.1` and Node `>=22.12.0`. This is more specific than saying “React 19 supported.” The workspace declares `^19.1.0`; installed/locked versions must be checked before adoption. The SDK has a custom license; default permission is development-only, with production requiring a valid trial/commercial/hobby license. Hobby eligibility is discretionary and requires attribution. [Pinned manifest](https://github.com/tldraw/tldraw/blob/5e46744c5daa35aaa94b46f32e7ec7a2088cc1f3/packages/tldraw/package.json), [license text](https://github.com/tldraw/tldraw/blob/5e46744c5daa35aaa94b46f32e7ec7a2088cc1f3/LICENSE.md), [license guide](https://tldraw.dev/community/license).

- **Verified:** nested groups, multiple selection/navigation, built-in history stopping points, cancellation and snapshot/local IndexedDB persistence exist. Plain groups have no visual properties and arrows cannot bind directly to them; frames clip children. A Mermaid subgraph container therefore needs a deliberate representation. [Groups](https://tldraw.dev/sdk-features/groups), [selection](https://tldraw.dev/sdk-features/selection), [frames](https://tldraw.dev/sdk-features/frame-shape), [history](https://tldraw.dev/sdk-features/history), [persistence](https://tldraw.dev/docs/persistence).
- **Verified:** `@tldraw/mermaid` converts flowchart, sequence, state and mindmap input into editable native shapes; unsupported types can fall back to SVG. Subgraphs become container rectangles. Its inspected source pins Mermaid **11.16.1**. The public export index includes import/render APIs, with no reverse Mermaid serializer exported. **Inference:** this helps import but does not establish bidirectional authoring or latest-Mermaid compatibility. [Mermaid integration guide](https://tldraw.dev/docs/mermaid), [pinned package](https://github.com/tldraw/tldraw/blob/5e46744c5daa35aaa94b46f32e7ec7a2088cc1f3/packages/mermaid/package.json), [pinned public exports](https://github.com/tldraw/tldraw/blob/5e46744c5daa35aaa94b46f32e7ec7a2088cc1f3/packages/mermaid/src/index.ts).

## 3. Layout, performance, packaging and host constraints

| Concern | Verified evidence | Inference / unknown for this repository |
| --- | --- | --- |
| ELK | elkjs accepts hierarchical JSON, layout options and returns a Promise; browser Web Workers and execution-time reporting are supported. [README](https://github.com/kieler/elkjs) | Worker URL/assets must be bundled locally. A Promise alone does not move CPU work off the main thread. Nested ports, loops, parallel edges and stale asynchronous results need verification. |
| SSR/SSG | React Flow documents server rendering with explicit node dimensions and handle positions; container dimensions are needed for server `fitView`. [SSR guide](https://reactflow.dev/learn/advanced-use/ssr-ssg-configuration) | A static SEO shell plus a client-mounted editor is an option, not a decision. For SVG, maxGraph and tldraw, no full SSR integration was demonstrated. Browser-only initialization and storage must respect the repo's ClientOnly/hydration rules. |
| Safari and touch | React Flow warns that HTML drag/drop is unsuitable for touch and provides pointer-event alternatives. tldraw documents Safari-specific rendering simplifications. [Drag/drop](https://reactflow.dev/examples/interaction/drag-and-drop), [tldraw performance](https://tldraw.dev/sdk-features/performance) | Exact minimum Safari/iOS versions and this app's interactions remain **unknown**. Test trackpad pinch, pointer cancellation, touch connection gestures, text editing/IME, keyboard shortcuts, SVG text and exports. General browser-support claims do not replace those tests. |
| React Flow performance | Docs recommend memoized nodes/callbacks and avoiding broad subscriptions during dragging. [Performance guide](https://reactflow.dev/learn/advanced-use/performance) | FPS, memory and supported graph size are **unknown** for the intended custom nodes, styles and grouping. |
| maxGraph package cost | Docs distinguish the broad `Graph` setup from opt-in `BaseGraph` and explain ongoing tree-shaking constraints. [Tree-shaking](https://maxgraph.github.io/maxGraph/docs/usage/tree-shaking/) | No Vite production chunk measurement here. “Zero dependencies” is not a byte-size or speed claim. |
| tldraw package cost | Source includes rich-text/editor/UI dependencies; docs support locally bundled assets. Its Mermaid guide calls the dependency approximately 2 MB and loads it lazily. [Manifest](https://github.com/tldraw/tldraw/blob/5e46744c5daa35aaa94b46f32e7ec7a2088cc1f3/packages/tldraw/package.json), [installation/assets](https://tldraw.dev/installation), [Mermaid integration](https://tldraw.dev/docs/mermaid) | That upstream estimate does not specify a comparable gzip/brotli setup. No cross-candidate byte ranking is established. Fonts/icons must be self-hosted for the intended local/offline experience. |

**Unknown across all candidates:** actual production JS/CSS/worker/font bytes; cold-import time; render/layout latency; drag latency; memory; PNG/SVG export fidelity; local-storage quota behavior. Before selection, a bounded prototype can measure the same corpus (for example 50/200/500 nodes with two nesting levels, cross-group edges and cycles), rather than extrapolating from different upstream demos. Counts are proposed test inputs, not performance commitments.

## 4. What the named reference products actually establish

### TryMermaid

**Verified as a first-party product claim, not hands-on validation:** the identifiable site is **trymermaid.app**. It describes dragging shapes, drawing connections, renaming in place, canvas/code synchronization, and storing layout for exports/share links. The homepage distinguishes flowchart visual editing from code/preview support for other types. It identifies itself as an independent product built on Mermaid Live Editor's MIT code; that does not license all of TryMermaid's own additions. [Product homepage](https://trymermaid.app/).

**Verified:** its privacy policy explicitly lists saved code, settings and **canvas layout** separately; unsaved work uses browser storage and the URL fragment. It also describes accounts, analytics and server storage. **Inference:** use the editing experience as a reference, but do not import its service/data assumptions into this repository. **Unknown:** the canvas implementation, complete syntax round-trip behavior, license of proprietary changes, nested group interaction quality, and whether manual geometry survives plain Mermaid-only export. [Privacy policy, updated 2026-09-18](https://trymermaid.app/privacy).

### draw.io / diagrams.net

**Verified:** current official documentation describes two Mermaid insertion modes: native shapes inside a Mermaid container, or a single SVG image. In native mode users can modify labels/styles, reposition/resize shapes and repath connectors. Regenerating from source reapplies style/label overrides but discards positions, dimensions, connection points and paths; added shapes are also discarded. Ungrouping removes the stored source. Older image-based documents do not automatically become native containers. [Official Mermaid manual](https://www.drawio.com/docs/manual/mermaid/).

**Inference:** the cited behavior demonstrates a useful “source + editor overlays” pattern and exposes a regeneration tradeoff. It does **not** demonstrate lossless native-shape-to-Mermaid code generation. **Unknown:** parity between that current manual and every desktop/embed/deployment version. A search-indexed developer note was not retrievable from the inspected drawio source commit, so it is not used as implementation evidence.

## 5. Decisions this evidence leaves open

1. Which promise matters: portable Mermaid semantics with automatic layout, a persistent free-layout editor document, or both with explicit differences? A product screenshot cannot settle this.
2. Whether code export intentionally omits editor geometry, includes optional editor metadata comments, or has a separate project file. Comments can preserve data for this editor without making other renderers honor it.
3. Whether preview/export must match the editable canvas, the official Mermaid renderer, or offer both views with named expectations.
4. How imports retain unsupported original syntax while visual changes are applied; how destructive conversion is signaled; whether source and geometry share one undo transaction.
5. Which engine and exact versions satisfy the prototype, licensing, Safari, SSG and local-assets checks. No candidate is selected by this report.

Research-only verification: inspected first-party docs and the pinned source manifests/public API above; did not modify application code, dependency declarations or the user's primary working tree. `git diff --check` passed. Attempted `pnpm lint && pnpm typecheck && pnpm build` in the isolated worktree using temporary dependency symlinks; pnpm attempted dependency reconciliation and stopped with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`. The command chain therefore did not establish lint/typecheck/build success. Removed the temporary links without permitting dependency replacement. No application/browser validation is claimed for this report-only change.
