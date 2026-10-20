# Semantic color review

The user requested a colored primary action, clear hierarchy, and success, error, warning and informational colors on 2026-10-19. This replaces the F prototype's monochrome override. Existing page layouts and operations remain.

| Role        | Light and dark treatment              | Current use                                                                                       |
| ----------- | ------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Primary     | Blue solid fill, contrasting text     | Main exports, QR downloads, active playback controls, focus rings and input accents               |
| Secondary   | Soft blue fill, blue foreground       | Secondary actions, selected task tabs and theme selection                                         |
| Success     | Green foreground or soft green fill   | Confirmed copying, successful nine-patch detection and completed frame cropping                   |
| Error       | Red foreground with soft red fill     | Import and crop failures; destructive actions use solid red                                       |
| Warning     | Amber foreground with soft amber fill | Lottie asset warnings, mixed frame sizes, unavailable crop content and nine-patch tiling warnings |
| Information | Cyan-blue foreground or soft fill     | No-op crop results and pending/resource information                                               |

Status labels and existing icons remain alongside color. Copy success temporarily colors the whole action, keeping the icon readable even when the action was a solid primary button. Frame crop messages carry an explicit typed tone; the UI does not classify translated message strings.

## Tokens and scope

All palette values live in [index.scss](../../apps/web/src/index.scss). The review palette defines the usual primary, secondary, foreground, background, input, border, ring and chart tokens, plus `success`, `warning`, `destructive` and `info` solid/foreground/muted/muted-foreground families. Components reference semantic utilities or variables.

[Vite](../../apps/web/vite.config.ts) enables the Sass review-palette flag only for the development server. The root light/dark palette activates while an F prototype is mounted, so portals and parameter-image export read the same colors. Production builds exclude this review palette; the original production light/dark values are unchanged. Shared token mappings remain available without changing production colors.

This applies to the home and shared prototype styling, with status mapping reviewed for the four public tools. Hidden tools inherit shared styling, but their page design/review remains deferred. The existing `docs/DESIGN.md` is not rewritten as a final specification in this review.

## Verification boundary

The source palette passed 52 numeric sRGB contrast checks across light and dark themes: the minimum core text-pair ratio is 5.45:1 and the minimum input-token border ratio is 3.07:1. This checks solid token combinations, not every translucent, disabled, image or gradient state.

Sass checks confirm the palette is included for development and omitted for production. Repository lint, type checking, the production build and a separate in-memory prototype bundle are checked in the [validation record](prototype-validation.json). Browser automation remains unavailable following the earlier policy denial; no new screenshots or live light/dark acceptance are claimed.
