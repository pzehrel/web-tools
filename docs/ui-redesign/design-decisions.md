# UI redesign decisions

These decisions summarize the review completed on 2026-10-20. They preserve the approved scope and rationale, not the current implementation status. The [historical implementation specification](implementation-spec.md), [GitHub specification and discussion](https://github.com/pzehrel/web-tools/issues/1), [current design guide](../DESIGN.md) and [production acceptance record](../ui-redesign-acceptance.md) provide the detailed contracts and later evidence. [简体中文](design-decisions.zh-CN.md).

## Users and devices

- Prioritize frequent development and design work. Keep import, parameter adjustment, preview and export easy to reach; place first-use explanations near the relevant control.
- Use URL editing and QR results, nine-patch parameters and canvas, and multi-frame import/order/preview/export as comparable design tasks.
- Desktop browsers are the primary workspace. Phones retain import, basic parameters, preview and export. Prioritizing desktop for precise slicing and multi-frame ordering does not remove existing phone capabilities.

## Public scope and navigation

- The home and tool switcher expose URL and QR, frame animation, Lottie preview and nine-patch. Tool pages provide return and switching actions; use “URL 与二维码” consistently in Chinese navigation.
- CSS shine and font toolkit are deferred and hidden from navigation. Their existing direct routes and capabilities remain available.
- Preserve existing engines, stored records, route compatibility and SSG hydration. This redesign does not add a backend, accounts, cloud synchronization or desktop packaging.

## Reviewed interface

- Adopt the reviewed F direction: compact controls, visible canvases, floating task panels, light/dark semantic colors and borderless icon actions. Blue is primary, light blue secondary, and green/red/amber/cyan distinguish success/failure/warning/information.
- URL input and QR share an equal-height top row; the recursive parameter tree and records each occupy a full row. Keep the recursive editor instead of adding a flat parsing summary.
- Frame animation keeps a full-width bottom sequence with a short playback/progress control above it. Lottie uses narrow left task tabs and an independent atlas view. Nine-patch keeps frequent center-crop controls and a movable, resizable preview HUD.
- Keep both direct QR exports: the page exports the pure QR image; the enlarged URL preview exports the combined image, with plain text falling back to the pure QR image. Remove the download dropdown (U17).
- Remove playback-following thumbnail highlighting and automatic following (F06), while retaining selection, focus, reordering, pause/seek and the progress indicator.
- Do not emphasize data location or upload behavior in interface copy. This wording decision does not change the processing mechanism or compatibility requirements.

## Evidence and retained references

The [feature baseline](README.md) and [prototype mapping](prototype-current.md) preserve behavior IDs and dated review boundaries. Prototype omissions never reduce the approved feature scope. Design approval, source review and compilation are distinct from production-browser acceptance.

The repository retains the specification, decisions, feature inventories and dated validation reports. Temporary screenshots, export samples, prototype source copies, patches and migration working files are no longer retained. Historical checks referring to those artifacts describe past runs and cannot be reproduced from the retained documents alone. The [URL review](url-review.md) records a rejected layout; the accepted layout above takes precedence.

The specification and twelve implementation issues were migrated to GitHub on 2026-10-20 under the [parent specification](https://github.com/pzehrel/web-tools/issues/1). Task state and dependencies are tracked there; local documents are references rather than a second task tracker.
