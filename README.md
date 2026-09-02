# Web Tools

[Chinese](README.zh-CN.md)

Web Tools is a browser-first collection of focused utilities for URLs, QR codes, image animation, Lottie assets, nine-patch images, and CSS effects. The repository is a pnpm workspace monorepo: the static frontend lives in `apps/web/`, while the optional API MVP lives in `apps/server/`.

## Start here

The public site currently processes tool inputs in the browser. No frontend request uploads tool data to a server. Saved tool records use IndexedDB; theme preferences use `localStorage`. The optional server is implemented, but the frontend HTTP storage adapter is not connected yet, so configuring a server URL does not switch the current frontend away from IndexedDB.

Requirements: Node.js 22 and pnpm 11.7 (the repository declares `pnpm@11.7.0` in `package.json`). From the repository root:

```bash
pnpm install
pnpm dev
```

The development site is served at `http://localhost:1420`. To build the pre-rendered static site and preview the output:

```bash
pnpm build
pnpm preview
```

## Workspace commands

| Command           | Purpose                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------- |
| `pnpm dev`        | Run the frontend development server on port 1420.                                             |
| `pnpm build`      | Type-check and build all frontend routes as static HTML.                                      |
| `pnpm preview`    | Preview `apps/web/dist/` with Vite.                                                           |
| `pnpm dev:server` | Run the Node API in `apps/server/`; see [`apps/server/README.md`](apps/server/README.md).     |
| `pnpm dev:worker` | Run the Cloudflare Workers API locally; see [`apps/server/README.md`](apps/server/README.md). |
| `pnpm lint`       | Run the repository ESLint configuration.                                                      |
| `pnpm typecheck`  | Run type-checking for every workspace package.                                                |
| `pnpm test`       | Run tests for every workspace package.                                                        |
| `pnpm release`    | Create and push the repository's CalVer release tag.                                          |

## Available tools

The homepage currently shows tools whose registry status is `ready`:

| Tool            | Route                    | What it does                                                                                                    |
| --------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| URL and QR      | `/tools/url-qrcode`      | Parse URLs and paths recursively, edit nested parameters, and convert between URL text and QR codes.            |
| Frame animation | `/tools/frame-animation` | Import image frames, adjust playback, preview the animation, and export sprite CSS/LESS/SCSS.                   |
| Lottie preview  | `/tools/lottie-preview`  | Preview a Lottie package, optimize referenced images into atlases, and export a ZIP that Lottie can still play. |
| Nine-patch      | `/tools/nine-patch`      | Define four slice lines, preview `border-image`, and export CSS/SCSS/Less plus an optional smaller PNG.         |
| CSS shine       | `/tools/css-shine`       | Tune a sweep effect and copy standalone CSS for cards, buttons, badges, or transparent images.                  |

The legacy routes `/tools/qrcode-generator` and `/tools/url-parser` redirect to `/tools/url-qrcode`. The font toolkit has an implementation and route, but is marked `hidden` and is not shown on the homepage.

## Repository layout

```text
apps/web/                 # React frontend, SSG routes, browser-side tools
apps/server/              # Optional Hono API: Node/Postgres/fs or Workers/D1/R2
docs/BACKEND.md           # Backend and storage architecture decisions
docs/DESIGN.md            # Neo-Brutalist UI rules
scripts/release.mjs       # CalVer release script
wrangler.jsonc            # Static frontend Worker configuration
```

For frontend-specific routing, SSG, storage, and tool-development rules, read [`apps/web/README.md`](apps/web/README.md). For API development and Cloudflare resources, read [`apps/server/README.md`](apps/server/README.md). The design system is documented in [`docs/DESIGN.md`](docs/DESIGN.md), and the backend decisions and compatibility boundary are in [`docs/BACKEND.md`](docs/BACKEND.md).

## Build and deployment

`pnpm build` runs the frontend TypeScript project build and the repository's direct SSG entry point, producing nested route output under `apps/web/dist/`. The root `wrangler.jsonc` publishes that directory as Cloudflare Workers static assets.

GitHub Actions runs linting, type-checking, tests, and the build before deployment. Pull requests and pushes to `main` upload preview versions; a `v*` tag deploys production. The production custom domain is configured in Cloudflare rather than stored in `wrangler.jsonc`. The workflow also deploys the optional API Worker and applies remote D1 migrations for release tags; API prerequisites are documented in [`apps/server/README.md`](apps/server/README.md).

## Contributing

Keep browser-only processing browser-only, preserve the SSG hydration constraints, and follow the UI rules in [`docs/DESIGN.md`](docs/DESIGN.md). Use pnpm for workspace commands. Before submitting a change, run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
