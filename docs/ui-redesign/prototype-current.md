# Current full-function F prototype

> **Historical prototype record:** This page describes the removed design prototype, not current product usage. Prototype routes and filenames are historical identifiers only; see the [design decisions](design-decisions.md) for the approved direction and the [acceptance record](../ui-redesign-acceptance.md) for production validation.

[简体中文](prototype-current.zh-CN.md) · [Preservation baseline](README.md) · [Machine-readable mapping](prototype-current.json)

The six redesigned tools now provide UI and operation entries for all **119 tool feature groups** in the baseline, plus the shared navigation, theme and canvas controls. This is a design prototype, not production implementation or exhaustive regression acceptance. Original parsing, rendering, optimization and export engines are reused. No existing capability is removed by this layout proposal.

The old [coverage table](coverage.json) is frozen at the audit before this expansion; it is not the status of the current F. Feature IDs and preservation criteria in the baseline remain authoritative. The table below records current locations for all 128 IDs.

## How to review

The [production implementation specification](implementation-spec.md) is now published for the home, shared interface and four public tools. Hidden-tool entries below remain retention/reference material; their redesign is deferred.

At review time, desktop canvas tools opened directly onto a full canvas with floating controls. Phones exposed the same controls through canvas/material/preview/parameter tabs, with advanced disclosures for less frequent parameters. The home showed four tools; CSS shine and font toolkit had no entries on the home or in the tool-page switcher, while retaining their direct routes. Prototype routes in the table below no longer open a runnable prototype.

| Tool            | Prototype                          | Main organization                                                                                          |
| --------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| URL / QR        | `/tools/url-qrcode?variant=F`      | Input toolbar, recursive editable tree, QR, records; no flat parsed-results summary                        |
| Frame animation | `/tools/frame-animation?variant=F` | Narrow left parameters, right canvas, unified toolbar, bottom materials with short playback directly above |
| Nine-patch      | `/tools/nine-patch?variant=F`      | Source canvas, independent floating eight-direction resizable preview, Parameters / CSS / Records          |
| Lottie          | `/tools/lottie-preview?variant=F`  | Main canvas, independent atlas, floating playback, three task tabs and persistent comparison/export        |
| CSS shine       | `/tools/css-shine?variant=F`       | Preview and code with compact controls                                                                     |
| Font toolkit    | `/tools/font-toolkit?variant=F`    | Imported-file toolbar, four task tabs, main content with compact parameters                                |

All icon-only actions use the same borderless treatment across the home and six tool prototypes, including shared theme controls, canvas buttons, HUD controls, record actions and tree actions. Theme controls also remove their outer outline and internal separators. Hover fills, selected fills, disabled states and keyboard focus indicators remain. This applies to icon-sized Button controls and explicitly labeled native icon actions; form fields, color swatches, text actions and panel boundaries keep their existing borders. Toolbar imports that collapse to icons on narrow screens follow the same rule.

The three theme controls share a fixed 28 × 28 px size with centered 16 px icons on desktop and mobile. Selection uses the secondary fill and foreground text in both themes.

The shared F palette uses a blue primary, soft blue secondary, green success, red errors, amber warnings and cyan-blue information. See the [semantic color review](color-system.md) for mappings, light/dark tokens and validation limits.

## Records and acceptance boundaries

URL, frames, nine-patch and Lottie use **`web-tools-ui-PROTOTYPE-wipe-me`**, an isolated IndexedDB database. Their save/load/delete flows are real and survive refresh. The prototype does not read, migrate or overwrite the product database or old URL localStorage records. Those compatibility requirements remain in U23/G06 for formal implementation. Shine/font have no project-persistence feature in the baseline; none is invented here.

`interface-wired` means an entry invokes its actual handler/engine, not that every input and browser has passed. `isolated-store` has the same UI but deliberately separate data. `product-acceptance-deferred` preserves the product shell while the redesigned production SSG/SEO or Safari standalone acceptance is still pending. These are implementation boundaries, not scope reductions.

## Current UI mapping

Each ID links to the unchanged preservation criterion. Entries below are locations in the new F, not a replacement feature specification.

### URL / QR

Desktop input and QR panels share the top grid row with equal heights. The editable tree occupies the full second row, and records occupy the full third row. At widths of 800 px or less, all sections stack vertically. Existing controls and processing remain unchanged.

Download interaction replaces the historical U17 menu by explicit user request: the page downloads pure QR PNG; the preview dialog downloads QR with parameters for URL content and pure QR for plain text. Generating disables the dialog action, and failures remain visible there. The two export formats remain available without a dropdown.

[2026-10-19 review and gap audit](url-review.md)

| ID                     | Entry in current F                                                                 | State             |
| ---------------------- | ---------------------------------------------------------------------------------- | ----------------- |
| [U01](features/url.md) | Input: URL and query text                                                          | `interface-wired` |
| [U02](features/url.md) | Tree: recursive parameters and hash                                                | `interface-wired` |
| [U03](features/url.md) | Tree: key, value and base editors                                                  | `interface-wired` |
| [U04](features/url.md) | Inline editor: commit, cancel and initial focus                                    | `interface-wired` |
| [U05](features/url.md) | Tree: add and insert actions                                                       | `interface-wired` |
| [U06](features/url.md) | Tree: delete confirmation                                                          | `interface-wired` |
| [U07](features/url.md) | Tree: node drag and drop                                                           | `interface-wired` |
| [U08](features/url.md) | Input and tree: copy actions                                                       | `interface-wired` |
| [U09](features/url.md) | Variable template below tree: preview and copy                                     | `interface-wired` |
| [U10](features/url.md) | Input toolbar: example                                                             | `interface-wired` |
| [U11](features/url.md) | QR panel: generated image                                                          | `interface-wired` |
| [U12](features/url.md) | QR panel: image picker, drop and paste                                             | `interface-wired` |
| [U13](features/url.md) | Input and QR panel: empty and error messages                                       | `interface-wired` |
| [U14](features/url.md) | QR image: enlarged tree dialog                                                     | `interface-wired` |
| [U15](features/url.md) | Page download button: pure QR PNG                                                  | `interface-wired` |
| [U16](features/url.md) | Preview dialog download: QR with parameters; plain text falls back to QR           | `interface-wired` |
| [U17](features/url.md) | Direct downloads: disabled, drawing and error states; menu removed by user request | `interface-wired` |
| [U18](features/url.md) | Input toolbar: save and selected-record update                                     | `interface-wired` |
| [U19](features/url.md) | Record list: inline rename                                                         | `interface-wired` |
| [U20](features/url.md) | Record list: load and deselect                                                     | `interface-wired` |
| [U21](features/url.md) | Record item: desktop tooltip and mobile dialog                                     | `interface-wired` |
| [U22](features/url.md) | Record list: copy, delete and clear confirmations                                  | `interface-wired` |
| [U23](features/url.md) | Record list: isolated durable database; legacy migration deferred                  | `isolated-store`  |
| [U24](features/url.md) | Input: hash restore and debounced share update                                     | `interface-wired` |
| [U25](features/url.md) | Empty input, tree and QR states; active example button                             | `interface-wired` |

UI source (`ui-redesign-url.prototype.tsx`)

### Frame animation

| ID                        | Entry in current F                                              | State             |
| ------------------------- | --------------------------------------------------------------- | ----------------- |
| [F01](features/motion.md) | Import toolbar and canvas drop                                  | `interface-wired` |
| [F02](features/motion.md) | Import toolbar: ZIP and directory                               | `interface-wired` |
| [F03](features/motion.md) | Import and material strip: append and natural sort              | `interface-wired` |
| [F04](features/motion.md) | Canvas and toolbar: example                                     | `interface-wired` |
| [F05](features/motion.md) | Material strip: selection and select all/none                   | `interface-wired` |
| [F06](features/motion.md) | Material strip: metadata, selection and drag reorder            | `interface-wired` |
| [F07](features/motion.md) | Material toolbar: crop dialog with threshold and apply/cancel   | `interface-wired` |
| [F08](features/motion.md) | Floating playback and material strip: play, seek, step and keys | `interface-wired` |
| [F09](features/motion.md) | Playback tab: FPS, duration and timing                          | `interface-wired` |
| [F10](features/motion.md) | Playback tab: two-ended frame range and reset                   | `interface-wired` |
| [F11](features/motion.md) | Playback tab: direction and finite/infinite loops               | `interface-wired` |
| [F12](features/motion.md) | Canvas: pan, zoom and fit reset                                 | `interface-wired` |
| [F13](features/motion.md) | Canvas toolbar: border and background chooser                   | `interface-wired` |
| [F14](features/motion.md) | Playback tab: pixel rendering                                   | `interface-wired` |
| [F15](features/motion.md) | Sprite tab: rows/columns and source-resolution PNG download     | `interface-wired` |
| [F16](features/motion.md) | Sprite tab: live preview and output dimensions                  | `interface-wired` |
| [F17](features/motion.md) | Code tab: CSS/Less/SCSS, switches, selection and copy           | `interface-wired` |
| [F18](features/motion.md) | Project tab: name, save, load and delete                        | `interface-wired` |
| [F19](features/motion.md) | Import toolbar: clear materials                                 | `interface-wired` |
| [F20](features/motion.md) | Canvas, strip, crop and output: errors, empty and busy states   | `interface-wired` |

UI source (`ui-redesign-frames-full.prototype.tsx`)

The desktop frame workspace uses a 240px left panel with Playback / Sprite / Code / Project tabs and persistent PNG export. Import, example, clear, reset, bounds and background controls share one toolbar above the right canvas. The sequence spans the full bottom width, including beneath the left panel, with the short playback strip directly above it. The left panel ends above the sequence and scrolls internally when needed. The sequence keeps selection, drag reorder, crop and sort; thumbnails show source dimensions and bytes directly. Canvas fitting reserves space below the preview for the sequence's measured height and playback controls, and playback stays centered in the right workspace. Its short progress slider follows playback and supports pointer or keyboard seeking across selected frames; seeking pauses playback without changing the configured playback/export range. Empty or single-frame sequences disable seeking. Phones retain Canvas / Materials / Settings views with the same controls; playback also sits above the sequence in Materials view. At the user's request, thumbnails no longer follow or highlight the playing frame; current-frame feedback stays in the progress control, and thumbnail clicks still pause and seek. This explicitly supersedes F06's historical automatic-highlight requirement. All other F01–F20 capabilities remain required.

### Nine-patch

| ID                      | Entry in current F                                                             | State             |
| ----------------------- | ------------------------------------------------------------------------------ | ----------------- |
| [N01](features/nine.md) | Import toolbar and source-canvas drop                                          | `interface-wired` |
| [N02](features/nine.md) | Import messages and valid replacement                                          | `interface-wired` |
| [N03](features/nine.md) | Source-canvas and toolbar: example                                             | `interface-wired` |
| [N04](features/nine.md) | Image replacement initializes parameters and fits canvas                       | `interface-wired` |
| [N05](features/nine.md) | Import toolbar: clear                                                          | `interface-wired` |
| [N06](features/nine.md) | Parameters tab: four constrained source-pixel margins                          | `interface-wired` |
| [N07](features/nine.md) | Source canvas: four draggable cut lines                                        | `interface-wired` |
| [N08](features/nine.md) | Cut lines: keyboard sliders and Shift acceleration                             | `interface-wired` |
| [N09](features/nine.md) | Parameters tab: reset slice margins                                            | `interface-wired` |
| [N10](features/nine.md) | Parameters tab: automatic pixel analysis                                       | `interface-wired` |
| [N11](features/nine.md) | Parameters tab: linked/independent border widths                               | `interface-wired` |
| [N12](features/nine.md) | Parameters tab: outset                                                         | `interface-wired` |
| [N13](features/nine.md) | Parameters tab: center fill                                                    | `interface-wired` |
| [N14](features/nine.md) | Parameters tab: independent X/Y repeat                                         | `interface-wired` |
| [N15](features/nine.md) | Parameters tab: center crop axes, keep size and minimum                        | `interface-wired` |
| [N16](features/nine.md) | Source canvas: crop masks and explanation                                      | `interface-wired` |
| [N17](features/nine.md) | Persistent panel footer: cropped PNG download                                  | `interface-wired` |
| [N18](features/nine.md) | Movable/resizable HUD: live border-image and dimensions                        | `interface-wired` |
| [N19](features/nine.md) | Preview: numeric dimensions, eight resize handles and keyboard corner controls | `interface-wired` |
| [N20](features/nine.md) | Source canvas: independent pan and zoom                                        | `interface-wired` |
| [N21](features/nine.md) | Preview: independent pan, zoom and reset                                       | `interface-wired` |
| [N22](features/nine.md) | Both canvases: initial fit and resize-aware reset                              | `interface-wired` |
| [N23](features/nine.md) | Canvas controls: shared border and themed backgrounds                          | `interface-wired` |
| [N24](features/nine.md) | CSS tab: longhand/shorthand and image placeholder                              | `interface-wired` |
| [N25](features/nine.md) | Persistent panel footer and CSS tab: copy and feedback                         | `interface-wired` |
| [N26](features/nine.md) | CSS tab: scoped select-all and placeholder tip                                 | `interface-wired` |
| [N27](features/nine.md) | Persistent panel footer: save image and all output parameters                  | `interface-wired` |
| [N28](features/nine.md) | Record tab: names, bytes and restored image/settings                           | `interface-wired` |
| [N29](features/nine.md) | Record tab: delete and refresh                                                 | `interface-wired` |

UI source (`ui-redesign-nine-full.prototype.tsx`)

The revised nine-patch workspace uses a 240px left panel with Slice, Center Crop and Rendering groups. Border widths, outset, fill and both repeat axes stay expanded; CSS and Records remain separate tabs. Copy CSS, Save and cropped PNG download stay in the panel footer. A single top toolbar contains image actions, source metadata, source-view reset and shared background/bounds controls. The stretch preview is an overlay HUD, initially at the lower right. Drag its title bar to move it, or its outer edges/corners to resize the HUD; inputs and buttons do not start a drag. HUD geometry stays within the available canvas, re-clamps after viewport changes and has a separate layout-reset button. Keyboard arrows move the focused title grip or resize the focused lower-right outer handle by 8px (Shift: 32px). The source canvas no longer reserves a fixed slot for the HUD. Logical stretch dimensions remain independent: numeric inputs (96–720 × 64–480), eight-direction content resizing, corner keyboard controls, internal pan/zoom and view reset are retained. Phones retain Editor / Preview / Parameters and Output views, with HUD movement/resizing constrained to the preview area. HUD position and size are view state and are not saved in editing records. Existing processing and storage logic are unchanged. This revision has compiler and source checks only; browser interaction and visual verification were not rerun because automatic browser access was blocked by policy.

### Lottie

| ID                        | Entry in current F                                                                                    | State             |
| ------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------- |
| [L01](features/motion.md) | Import toolbar and canvas: ZIP or directory                                                           | `interface-wired` |
| [L02](features/motion.md) | Import messages: asset resolution and missing resources                                               | `interface-wired` |
| [L03](features/motion.md) | Toolbar: example, replace and clear                                                                   | `interface-wired` |
| [L04](features/motion.md) | Playback settings tab: playback library and renderer                                                  | `interface-wired` |
| [L05](features/motion.md) | Playback settings tab: meet/slice fit                                                                 | `interface-wired` |
| [L06](features/motion.md) | Compact dock below the preview: play, fractional frame seeking and metadata                           | `interface-wired` |
| [L07](features/motion.md) | Playback settings tab: speed, direction and loop                                                      | `interface-wired` |
| [L08](features/motion.md) | Main preview fits the available workspace beside the desktop left panel; pan, zoom and reset retained | `interface-wired` |
| [L09](features/motion.md) | Canvas toolbar: borders and themed backgrounds                                                        | `interface-wired` |
| [L10](features/motion.md) | Atlas optimization tab: enable and live rebuild                                                       | `interface-wired` |
| [L11](features/motion.md) | Atlas optimization tab: atlas size, spacing and extrusion                                             | `interface-wired` |
| [L12](features/motion.md) | Atlas optimization tab: rotation, trim and deduplication                                              | `interface-wired` |
| [L13](features/motion.md) | Atlas optimization tab: advanced power-of-two, square and alpha controls                              | `interface-wired` |
| [L14](features/motion.md) | Optimization messages: excluded animated resources                                                    | `interface-wired` |
| [L15](features/motion.md) | Persistent panel footer: before/after metrics and atlas statistics                                    | `interface-wired` |
| [L16](features/motion.md) | Toolbar entry: attached floating atlas viewer with independent pan, zoom, reset and close             | `interface-wired` |
| [L17](features/motion.md) | Persistent panel footer: real ZIP export from any task tab                                            | `interface-wired` |
| [L18](features/motion.md) | Project records tab: name, save, load and delete                                                      | `interface-wired` |
| [L19](features/motion.md) | Panel-footer message disclosure and mobile jump entry; busy and optimization states retained          | `interface-wired` |
| [L20](features/motion.md) | Mobile canvas/atlas/parameters navigation; gestures retained                                          | `interface-wired` |

UI source (`ui-redesign-lottie-full.prototype.tsx`)

### CSS shine

| ID                        | Entry in current F                                    | State             |
| ------------------------- | ----------------------------------------------------- | ----------------- |
| [C01](features/hidden.md) | Preview shape selector: card, button, badge and image | `interface-wired` |
| [C02](features/hidden.md) | Image mode: upload and replace masked image           | `interface-wired` |
| [C03](features/hidden.md) | Controls: trigger and direction                       | `interface-wired` |
| [C04](features/hidden.md) | Controls: five live animation sliders                 | `interface-wired` |
| [C05](features/hidden.md) | Controls: three presets                               | `interface-wired` |
| [C06](features/hidden.md) | Preview actions: replay and reset                     | `interface-wired` |
| [C07](features/hidden.md) | Code panel: complete live CSS and HTML                | `interface-wired` |
| [C08](features/hidden.md) | Code toolbar: copy and success/failure feedback       | `interface-wired` |
| [C09](features/hidden.md) | Preview and generated CSS: reduced-motion behavior    | `interface-wired` |

UI source (`ui-redesign-shine-full.prototype.tsx`)

### Font toolkit

| ID                        | Entry in current F                                           | State             |
| ------------------------- | ------------------------------------------------------------ | ----------------- |
| [T01](features/hidden.md) | Upload zone: TTF/OTF/WOFF/WOFF2 and errors                   | `interface-wired` |
| [T02](features/hidden.md) | Imported-file toolbar: metadata, replace and remove          | `interface-wired` |
| [T03](features/hidden.md) | Four tabs: preview, glyphs, health and subset                | `interface-wired` |
| [T04](features/hidden.md) | Preview tab: custom text and size slider                     | `interface-wired` |
| [T05](features/hidden.md) | Glyph tab: categories and counts                             | `interface-wired` |
| [T06](features/hidden.md) | Glyph tab: literal or Unicode search                         | `interface-wired` |
| [T07](features/hidden.md) | Glyph grid: load more, selection and detail                  | `interface-wired` |
| [T08](features/hidden.md) | Glyph detail: add to custom subset text                      | `interface-wired` |
| [T09](features/hidden.md) | Health tab: metrics and coverage                             | `interface-wired` |
| [T10](features/hidden.md) | Subset tab: three Chinese frequency levels                   | `interface-wired` |
| [T11](features/hidden.md) | Subset tab: ASCII, punctuation and custom text               | `interface-wired` |
| [T12](features/hidden.md) | Subset tab: missing-character warning                        | `interface-wired` |
| [T13](features/hidden.md) | Subset tab: WOFF2/WOFF/TTF, hinting and kerning              | `interface-wired` |
| [T14](features/hidden.md) | Subset tab: full format conversion                           | `interface-wired` |
| [T15](features/hidden.md) | Result panel: size, glyph count, download and font-face code | `interface-wired` |
| [T16](features/hidden.md) | Upload/export: busy, disabled and error states               | `interface-wired` |

UI source (`ui-redesign-font-full.prototype.tsx`)

### Shared behavior

| ID                        | Entry in current F                                                                    | State                         |
| ------------------------- | ------------------------------------------------------------------------------------- | ----------------------------- |
| [G01](features/shared.md) | Home and tool switcher: four ready tools only; hidden tool routes retained            | `interface-wired`             |
| [G02](features/shared.md) | All six routes and query/hash-preserving URL aliases; tool menu above canvas controls | `interface-wired`             |
| [G03](features/shared.md) | Left header: return-home action; desktop brand and mobile tool title                  | `interface-wired`             |
| [G04](features/shared.md) | Header: persistent system/light/dark control                                          | `interface-wired`             |
| [G05](features/shared.md) | Header: existing GitHub brand SVG and repository link in a new tab                    | `interface-wired`             |
| [G06](features/shared.md) | Shared isolated durable store; product records and migration deferred                 | `isolated-store`              |
| [G07](features/shared.md) | Canvas controls and protected editor/resize gestures                                  | `interface-wired`             |
| [G08](features/shared.md) | Dev-only Seo; production SSG unchanged, new-layout acceptance deferred                | `product-acceptance-deferred` |
| [G09](features/shared.md) | Manifest and standalone metadata retained; Safari standalone check deferred           | `product-acceptance-deferred` |

UI source (`ui-redesign-workspace.prototype.tsx`)

## Checks performed

- Browser inspection covered home plus six tools at 1440/390 widths in light/dark themes (28 views): one page title, no horizontal overflow, no page errors, and no page-level scrolling for the canvas tools. Latest Lottie views were separately refreshed after its responsive fixes.
- URL: empty/example, nested edits, hash reload and old-route hash compatibility, durable record save/rename/refresh. Earlier checks also exercised tree operations, variables, QR recognition/dialog and both image downloads; not every parsing/QR edge was re-run in this expansion.
- Frames: ZIP/directory/import/append, natural ordering, selection and drag operations, common-transparent-edge crop, range/direction/loops and keyboard stepping, source-resolution grid PNG, three code syntaxes, durable project restore including cropped frames. A prototype-only fix recognizes PNG bytes when restoring a cropped frame whose original filename ends in SVG; formal implementation needs this regression covered too.
- Nine-patch: imports and recovery, cut dragging/keyboard constraints, automatic analysis, independent widths/outset/fill/repeat, all eight preview resize handles, independent views, longhand/shorthand and clipboard, crop PNGs with both/X/Y axes (63×77 / 81×160 / 240×81 for test inputs), project refresh/load/delete, mobile advanced controls.
- Lottie: four engine/renderer combinations checked through actual canvas pixels or decodable SVG images; ZIP/directory, sample, all optimization controls, atlas zoom/reset, real ZIP contents and re-import, missing data/image recovery, named records across refresh and parameter restoration.
- Shine: all four shapes, image import, trigger/direction, preset/reset, actual clipboard CSS+HTML with filename and reduced-motion clause.
- Font: TTF import, four tabs, Unicode search/detail/custom subset, actual TTF and WOFF2 subset downloads, full conversion, health and text preview. WOFF2 used the real WASM path. Other input/output combinations remain to be exercised systematically.
- This pass does not certify real-device touch/pinch, every image/font format, multiple large atlases, animated-resource/complex-animation visual fidelity, Safari standalone, or migration of existing product records. Existing engines retain their corresponding entry paths; these checks remain required before formal acceptance.

Temporary screenshots, export samples and prototype sources are no longer retained. Prototype filenames above identify historical artifacts, not current repository paths. See the dated [validation results](prototype-validation.json) for recorded checks and the [design decisions](design-decisions.md) for the retained references. These documents alone cannot reproduce the historical runs.

Visual review was completed on 2026-10-20; the accepted scope is summarized in the [design decisions](design-decisions.md). Earlier entries on this page retain their dated review status. Design approval did not itself authorize deployment; production verification is recorded separately in the [acceptance guide](../ui-redesign-acceptance.md).

## Lottie task-panel review

On 2026-10-18 the user selected task tabs: Atlas optimization / Playback settings / Project records, with resource comparison and ZIP export kept visible in a separate panel footer. All task panels remain mounted; switching tabs preserves edited values and advanced-option state. Arrow keys and Home/End navigate these task tabs without changing prototype variant. Import, example and clear actions share one project toolbar; project metadata replaces the repeated tool title. This is approval of this organization choice, not final approval of the complete Lottie visual design.

Targeted checks covered all three tabs at 1440/390 in light/dark themes, fixed metric/export visibility while scrolling, parameter retention, named records across refresh, real ZIP download from the records tab, and mobile canvas/atlas/playback. The exported archive contains `data.json` and `atlas-1.png`. Other engine/format/device acceptance boundaries above still apply.

## Lottie toolbar and atlas placement review

The user rejected the loaded-status label beside the task tabs and the scattered metadata/reset/view-control placement. The label represented the entire project, not the adjacent records tab; it has been removed. Active import/export/optimization feedback and errors remain in their existing content layers. The toolbar now has one aligned row: file actions, project metadata, then reset/bounds/background/atlas controls. Reset occupies a stable position instead of appearing as a separate floating button after interaction. The background chooser opens below its control.

The proposed atlas placement replaces the persistent lower-left strip with a toolbar entry. On desktop it opens a floating viewer directly below the toolbar's right edge, beside the optimization panel, with a close action. Independent atlas pan/zoom/reset, multiple-image viewing and original data remain intact. On mobile, the existing Atlas view remains the entry, and desktop-open state cannot overlay the Canvas or Parameters views. Material messages sit above the playback bar, separate from the toolbar and atlas entry. This proposal still awaits visual review.

Checks covered button alignment and viewport bounds at 1440/1024/768/701/700/390/320 widths, ten desktop/mobile light/dark views, atlas open/close and anchoring, independent view operations, unchanged task tabs, named-record refresh/recovery/deletion, real ZIP export, and missing-image warnings followed by valid-project recovery. These checks do not replace the wider acceptance boundaries above.

## Lottie left panel and compact playback dock

The user requested a left-side panel and a shorter, relocated playback bar. On desktop the three task tabs, settings, resource comparison and export now sit in the left floating panel. The project toolbar spans the available workspace to its right, with the atlas viewer still opening below the toolbar's right edge. The animation fits and centers inside that available preview area, so initial content is not hidden behind the relocated panel. The canvas background remains continuous behind the floating UI.

The playback dock sits centered below this preview, up to 440px wide on desktop and 320px on mobile, shrinking further when needed. Playback, fractional seeking and frame counts retain their previous meaning. Seven viewport widths from 320 to 1440, ten light/dark desktop/mobile screenshots, seek/play/pause/reset, atlas access, and mobile export visibility were checked without page errors or overflow. The existing wider acceptance boundaries still apply.

The desktop panel was subsequently narrowed from 280px to 240px at the user's request. Workspace offsets and playback centering follow the same width value. Resource metrics retain every before/after value, with labels above values in the narrow desktop panel; mobile keeps its responsive panel width.

## Shared header corrections

The user reported the tool menu being covered by the Lottie toolbar, requested the home action on the left, and rejected the external-link arrow used as the GitHub icon. Pointer hit tests reproduced the menu defect: parts of the URL/frames links hit the canvas toolbar instead. The shared F header now sits above floating canvas controls and yields below active modal backdrops. The menu anchors to the right navigation group, keeping it within narrow viewports. The return-home action is first in the left group; mobile shows the back action and tool title while the home page retains its brand. GitHub reuses the existing site SVG without an extra dependency.

The focused repro is `.playwright-cli/prototype-header-repro.cjs`; it changed from obstructed menu links to unobstructed links after the fix. The shared-header browser check covers six tools at 1440/390/320 in light/dark themes, pointer hits across all menu rows, actual tool switching and returning home, GitHub identity/target, home-directory preservation, and the frame-crop modal remaining above the header. This corrects prototype behavior; production files remain unchanged.

## Lottie material messages inside the panel

Messages now sit in the persistent panel footer above resource comparison and export. Warnings start collapsed with their count; hard errors start expanded. Full details remain scrollable, with long paths wrapping. Expanded height is capped on short screens so export stays visible. Switching task tabs preserves disclosure state.

On mobile, issues replace the project-info slot with a compact message/failure entry. It opens Parameters, expands details and focuses the summary. A valid project clears resolved messages and restores metadata. Checks covered fourteen long missing-resource messages, hard import failure and recovery, 1440x900/390x844/320x667 light/dark views, twelve expanded/collapsed screenshots and export visibility. Broader acceptance boundaries above still apply.
