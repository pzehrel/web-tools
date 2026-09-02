# @web-tools/web

[Chinese](README.zh-CN.md)

`@web-tools/web` is the static React frontend for Web Tools. It is built as a pre-rendered site with Vite, React 19, React Router, and `vite-react-ssg`; the tool implementations run in the browser and do not require a backend.

## Development

Install dependencies from the repository root, then run the package through the root scripts:

```bash
pnpm install
pnpm dev
```

The development server uses port `1420` and has `strictPort` enabled. Package-level commands are also available:

```bash
pnpm --filter @web-tools/web dev
pnpm --filter @web-tools/web typecheck
pnpm --filter @web-tools/web test
pnpm --filter @web-tools/web build
```

## Frontend architecture

- `src/main.tsx` defines the data routes and starts `ViteReactSSG`.
- `src/root-layout.tsx` provides the shared outlet and site actions.
- `src/tools/index.ts` is the tool registry used by the homepage.
- `src/tools/<tool>/index.tsx` contains a tool page; each page owns its SEO metadata.
- `src/lib/storage/` contains the framework-independent `ToolStore` contract and IndexedDB implementation.
- `src/lib/react/use-tool-store.ts` is the React binding for tool records.
- `src/index.scss` is the Tailwind entry point and the only global stylesheet; tool-specific styles use `.scss`.

## Routes

| Route                    | Component         | Registry status |
| ------------------------ | ----------------- | --------------- |
| `/`                      | `App`             | —               |
| `/tools/url-qrcode`      | `url-parser`      | `ready`         |
| `/tools/frame-animation` | `frame-animation` | `ready`         |
| `/tools/lottie-preview`  | `lottie-preview`  | `ready`         |
| `/tools/nine-patch`      | `nine-patch`      | `ready`         |
| `/tools/css-shine`       | `css-shine`       | `ready`         |
| `/tools/font-toolkit`    | `font-toolkit`    | `hidden`        |

`/tools/qrcode-generator` and `/tools/url-parser` are compatibility redirects to `/tools/url-qrcode`. The fallback route renders the homepage for unmatched paths.

## Static data and privacy

The current storage factory always returns `IndexedDbToolStore`. Small string payloads remain in the `items` object store; binary `Blob` payloads are kept in the `blobs` object store and loaded only when a record is opened. Records are listed by tool and sorted by `updatedAt` descending.

The first IndexedDB open migrates the legacy URL and QR history keys when present. The old keys are removed only after the IndexedDB transaction succeeds; malformed or unavailable legacy storage is skipped without blocking the tool. Because IndexedDB and `localStorage` are browser APIs, storage-dependent reads must remain client-only during SSG.

The storage configuration can remember an optional `serverUrl`, but `HttpToolStore` is not implemented in the current factory. Do not describe remote persistence as available until the factory is changed and the integration is verified against [`apps/server/README.md`](../server/README.md).

## Adding a tool

1. Add metadata to the `tools` array in `src/tools/index.ts`, including a stable kebab-case `id`, user-facing `name` and `description`, a Lucide icon, `accentClass`, and the correct `status`.
2. Implement the page under `src/tools/<tool>/` and add the page's `<Seo>` metadata.
3. Register the route in `src/main.tsx` with an explicit route `id`, and add that same id to `ROUTE_IDS` so SSG hydration data is complete.
4. Add the route to `public/sitemap.xml` when it is publicly discoverable.
5. Reuse the shared `Button`, `Card`, stage, and storage primitives where they apply. Read [`../../docs/DESIGN.md`](../../docs/DESIGN.md) before making UI changes.

## SSG constraints

The custom `apps/web/scripts/ssg-build.mjs` entry point directly awaits Vite's build function. Keep it in use because the upstream CLI can exit before an asynchronous build finishes on some Node versions. The configured output style is nested, so `/tools/example` is emitted as `tools/example/index.html`.

Every route has a fixed id and `customCreateRouter` supplies matching `hydrationData.loaderData`. Keep these ids synchronized when changing routes. Components that read browser storage should use `ClientOnly` or an equivalent client-only boundary so the server-rendered HTML and the first client render remain consistent.

## Validation

From the repository root, the full validation set is:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

For route or hydration changes, also serve the built output with `pnpm preview` and verify that each route contains one rendered copy under `#root`. For visual changes, check both light and dark themes.
