# Web Tools design guide

Build compact workspaces for frequent link, animation and image tasks. The production interface follows the reviewed F design: a blue primary action, soft-blue secondary actions, clear semantic feedback, narrow task controls and visible canvases. Prototype files are reference material, never production runtime dependencies.

The public directory and tool switcher expose only URL and QR, frame animation, Lottie preview and nine-patch. CSS shine and font toolkit keep their direct routes. The registry in `apps/web/src/tools/index.ts` is the navigation source of truth. Do not add promotional claims about data location or uploads.

## Navigation and density

- `SiteHeader` owns the shared header, home-linked brand on desktop, public-tool switcher, theme controls and repository link. Tool workspaces do not add return buttons or permanent sidebar navigation.
- The header stays above ordinary canvas controls and below modal backdrops. The switcher closes after navigation, outside pointer interaction or Escape; Escape returns focus to its summary.
- Use compact spacing and controls. Avoid a large hero above tools. Canvas workspaces place narrow task controls beside the main canvas; mobile layouts stack or tab the controls so core actions remain reachable.
- Home entries form a compact four-column directory on desktop and two columns on phones. Distinguish groups with fine borders and spacing; avoid decorative shadows, gradients and raised cards.

## Semantic colors

All colors come from `apps/web/src/index.scss`. Never hard-code colors in components, including Tailwind palette classes such as `bg-blue-500`. Production light and dark palettes apply without a development flag.

| Purpose                                                   | Tokens                                                             |
| --------------------------------------------------------- | ------------------------------------------------------------------ |
| Page and text                                             | `background`, `foreground`                                         |
| Panels and popovers                                       | `card`, `card-foreground`, `popover`, `popover-foreground`         |
| Main action and focus                                     | `primary`, `primary-foreground`, `ring`                            |
| Secondary action and selection                            | `secondary`, `secondary-foreground`, `accent`, `accent-foreground` |
| Supporting content                                        | `muted`, `muted-foreground`                                        |
| Borders and form controls                                 | `border`, `input`                                                  |
| Successful, dangerous, warning and informational feedback | `success`, `destructive`, `warning`, `info`                        |
| Decorative charts                                         | `chart-1` through `chart-5`                                        |

Each feedback family has solid, `-foreground`, `-muted` and `-muted-foreground` variants. Use a text label or icon alongside color. Solid actions use the matching foreground; soft feedback uses the matching muted foreground. Keep success feedback readable when replacing a primary action's state. Explicitly model message tone rather than inferring it from translated strings.

## Controls and typography

- Reuse `Button`. Pure icon actions have no visible border; preserve hover, selection, disabled and keyboard-focus feedback. Every icon action needs an accessible name. Shared theme actions are equal 30px squares.
- Keep hover and pressed feedback to color changes, with short transitions. Do not shift or scale controls on hover. Avoid shadows and decorative motion.
- Use `font-mono` for headings, numbers and code; `font-sans` for prose. Prefer compact headings and readable supporting text. Use tabular numbers for measurements.
- Form labels remain clear and close to their fields. Group related values; segmented choices expose their selected state. Controls, fields and text must remain usable in both themes.
- All tool content uses semantic tokens. Semantic feedback and selected states may use their intended distinct hues; blue is the primary action hue rather than the only permitted hue.

## Canvas viewing and editing

Reuse `apps/web/src/lib/stage.ts` and `StageViewControls` / `useStageViewSettings` for image viewing.

- Fit the union of visible content to the stage as the default view. Zoom from 1% to 800% through wheel, trackpad pinch or two fingers; zoom and pan never change exported pixels or output parameters.
- Show the current zoom briefly after a zoom gesture. Initial import and reset use the same fit and center in canvas space unobstructed by visible HUDs, independently of editing/output settings.
- Dragging pans at any zoom. Guard cut lines, resize handles, buttons and other editing interactions before pan captures the pointer. Use native non-passive wheel handlers and `touch-none` where the canvas owns touch gestures.
- The outer layout determines the stage height. Keep its content clipped, with a positioned inner stage when needed to prevent large images from expanding the layout.
- Keep image import/replacement actions near the canvas. Viewing controls float separately: boundaries and themed checker/solid backgrounds affect viewing only and appear when content exists.
- Multiple canvases retain independent viewing transforms. Nine-patch source view, stretch-preview view and HUD geometry have separate resets. Background changes must not affect export output.

## Theme, metadata and verification

Retain the persisted `web-tools:theme` preference (`system`, `light`, `dark`), live system-theme changes and the pre-React first-paint script. Render stored preferences after hydration through `ClientOnly`.

Preserve SSG route IDs and hydration data, per-page `Seo`, legacy URL/QR redirects including query and hash content, hidden direct routes, unknown-route fallback, manifest/icon references and Safari web-app metadata.

Run `pnpm lint`, `pnpm typecheck` and `pnpm build` after changes. Check real product pages in light/dark themes, compact desktop and phone layouts, keyboard focus, menu/modal stacking and single-tree hydration. Canvas-specific acceptance belongs to each tool migration; source inspection or prototype coverage does not replace browser evidence. Native Safari standalone launch requires its own device/app check.
