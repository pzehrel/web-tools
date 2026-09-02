# @web-tools/server

[Chinese](README.zh-CN.md)

`@web-tools/server` is the optional Hono API MVP for storing tool assets and history. The same runtime-independent application is assembled for either Node/Docker or Cloudflare Workers. The current frontend still uses IndexedDB, so this API is not automatically used by the public frontend.

The broader architecture and compatibility boundary are documented in [`../../docs/BACKEND.md`](../../docs/BACKEND.md).

## Runtime matrix

| Concern            | Node / Docker path                                    | Cloudflare Workers path                                                           |
| ------------------ | ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| Entry point        | `src/index.ts` with `@hono/node-server`               | `src/worker.ts` with `export default { fetch }`                                   |
| Database           | Postgres through `pg` and `drizzle-orm/node-postgres` | D1 through `drizzle-orm/d1`                                                       |
| Schema             | `src/db/schema.pg.ts`                                 | `src/db/schema.sqlite.ts`                                                         |
| Blob storage       | `FsBlobStore` under `DATA_DIR`                        | `R2BlobStore` through the `BUCKET` binding                                        |
| Configuration      | `.env` and process environment                        | `apps/server/wrangler.jsonc` bindings and vars                                    |
| Runtime limitation | Full Node API surface available to the server         | Storage-only subset; Cloudflare Workers cannot run future Node child-process jobs |

`buildApp(deps)` in `src/app.ts` owns the shared routes and error handling. Each entry point injects its database, schema, blob store, health check, CORS origins, and registration flag through `src/deps.ts`.

## Local Node development

Requirements: Node.js 22, pnpm, and a reachable Postgres database. The default development connection string is `postgres://webtools:webtools@localhost:5432/webtools`.

From the repository root:

```bash
pnpm install
cp apps/server/.env.example apps/server/.env
# Edit DATABASE_URL if the development Postgres is not local.
pnpm --filter @web-tools/server db:push
pnpm dev:server
```

The Node server listens on `http://localhost:8787` by default. `db:push` is intended for development-time direct schema synchronization. For migration-based changes, use `db:generate` and `db:migrate` after reviewing the generated migration. `pnpm --filter @web-tools/server start` runs the server once without watch mode.

The Node environment reads `apps/server/.env` and gives explicitly injected shell or process variables precedence. Defaults are defined in `src/env.ts`: `PORT=8787`, `DATA_DIR=./data/files`, `TRUST_PROXY=0`, the local Postgres URL, the production site plus localhost as CORS origins, and registration disabled.

## Local Workers development

The Workers configuration is `apps/server/wrangler.jsonc`. On the first run, apply the D1 migrations to Wrangler's local database, then start the Worker:

```bash
pnpm --filter @web-tools/server db:migrate:d1:local
pnpm dev:worker
```

The local Worker also listens on `http://localhost:8787`. `wrangler dev` loads `apps/server/.env` as environment input when that file exists; the Worker uses its D1/R2 bindings and `CORS_ORIGINS`/`ALLOW_REGISTRATION` vars.

Run the repository's smoke checks with:

```bash
pnpm --filter @web-tools/server exec tsx scripts/smoke.ts
pnpm --filter @web-tools/server exec tsx scripts/smoke-passwords.ts
```

`smoke.ts` adapts its database assertions to an available or unavailable database and also checks authentication, CORS, and validation paths. `smoke-passwords.ts` checks the scrypt hash format, password verification, and token hashing without a database.

## HTTP API

All API errors use a JSON body such as `{ "error": "not found" }`. `/api/assets` requests require either a valid `wt_session` session cookie or an `X-Device-ID` header containing 8–64 characters. A valid session takes precedence; otherwise the request is scoped to the anonymous device ID. CORS allows only the configured origins and credentials are enabled.

### Authentication endpoints

| Method | Path                 | Request                                         | Success                                                       | Important failures                                                     |
| ------ | -------------------- | ----------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `POST` | `/api/auth/register` | JSON `{email, password}`; password length 8–128 | `201` with `{user, claimed}` and a 30-day `wt_session` cookie | `400` invalid body, `403` registration disabled, `409` duplicate email |
| `POST` | `/api/auth/login`    | JSON `{email, password}`                        | `200` with `{user, claimed}` and a 30-day `wt_session` cookie | `400` invalid body, `401` invalid credentials                          |
| `POST` | `/api/auth/logout`   | Session cookie is optional                      | `200` with `{ok: true}`                                       | —                                                                      |
| `GET`  | `/api/auth/me`       | Session cookie or `X-Device-ID`                 | `200` with authenticated user or anonymous device information | `401` when neither identity is supplied                                |

The session cookie is `HttpOnly`, `SameSite=Lax`, `Secure`, and scoped to `/`; browser-based local authentication therefore needs an HTTPS context for the cookie to work as configured. Login and registration are rate-limited to 10 requests per IP per minute. Successful login or registration claims existing anonymous assets for the supplied device ID and returns the count as `claimed`.

Example anonymous health and asset calls:

```bash
curl http://localhost:8787/api/health
curl -H 'X-Device-ID: local-device-123' \
  'http://localhost:8787/api/assets?tool=frame-animation'
```

### Asset endpoints

| Method   | Path                            | Contract                                                                                                                                                                                                                                                                                      |
| -------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/health`                   | Returns `{ok:true}` when the service and database respond; returns `503` with `{ok:false}` when the database probe fails.                                                                                                                                                                     |
| `GET`    | `/api/assets?tool=<id>`         | Lists up to 500 summaries for one tool, newest `updatedAt` first. Omit `tool` for all tools under the current identity.                                                                                                                                                                       |
| `POST`   | `/api/assets`                   | Form fields: required `toolId`; provide `payload` for a string or `file` for a Blob; optional `id`, `mimeType`, and JSON-string `meta`. At least one of `payload` or `file` is required; if both are sent, the file path is selected by the current handler. Same `id` uses upsert semantics. |
| `GET`    | `/api/assets/:id?tool=<id>`     | Returns metadata and an inline string `payload`. Blob payloads have `payload: null` and must be read from the raw endpoint.                                                                                                                                                                   |
| `GET`    | `/api/assets/:id/raw?tool=<id>` | Streams the Blob body with its stored MIME type when available.                                                                                                                                                                                                                               |
| `DELETE` | `/api/assets/:id?tool=<id>`     | Deletes the metadata and attempts to remove the stored Blob; returns `404` if the scoped record does not exist.                                                                                                                                                                               |

Example file upload:

```bash
curl -X POST http://localhost:8787/api/assets \
  -H 'X-Device-ID: local-device-123' \
  -F 'toolId=frame-animation' \
  -F 'file=@./frames.zip;type=application/zip' \
  -F 'meta={"name":"demo"}'
```

The request body limit is 100 MiB. List responses contain summaries only; large binary payloads are kept in the configured BlobStore. The database stores users, sessions, and asset metadata, while the file body is stored on the filesystem or R2.

## Registration switch

Registration is disabled by default. Set `ALLOW_REGISTRATION=true` or `1` temporarily when creating an account, then set it back to false. Login remains available while registration is disabled.

- Node: set the environment variable or edit `apps/server/.env`, then restart the process.
- Workers: change the `ALLOW_REGISTRATION` var in `apps/server/wrangler.jsonc` or deploy with `wrangler deploy --var ALLOW_REGISTRATION:true`.

## Cloudflare Workers deployment

The Worker configuration uses D1 binding `DB`, R2 binding `BUCKET`, `nodejs_compat`, and preview URLs. `workers_dev` is disabled; configure the production custom domain in Cloudflare's Worker settings rather than committing it to this repository.

One-time resource setup:

```bash
cd apps/server
wrangler d1 create web-tools-db
# Replace the placeholder database_id in wrangler.jsonc with the returned ID.
wrangler r2 bucket create web-tools-assets
wrangler d1 migrations apply web-tools-db --local --config wrangler.jsonc
wrangler deploy --config wrangler.jsonc
```

Before the first production deploy, set `CORS_ORIGINS` to the allowed frontend origins and ensure the Cloudflare token has Workers Scripts, D1, and R2 edit permissions. Release-tag CI applies remote D1 migrations before deploying the API Worker; pull requests and `main` pushes upload preview versions.

## Schema changes

The Postgres and SQLite schemas are intentionally structurally identical. When changing an asset, user, or session field:

1. Update both `src/db/schema.pg.ts` and `src/db/schema.sqlite.ts`.
2. Generate the Postgres and D1 migrations separately.
3. Apply the D1 migration locally and run the smoke checks.
4. Review and commit both migration sets.

```bash
pnpm --filter @web-tools/server db:generate
pnpm --filter @web-tools/server db:generate:d1
pnpm --filter @web-tools/server db:migrate:d1:local
pnpm --filter @web-tools/server exec tsx scripts/smoke.ts
```

## Docker status

The Node path is suitable for a future Node 22 Docker image with Postgres and a mounted `DATA_DIR`, but `Dockerfile` and `docker-compose.yml` are not currently present or built by this package. Treat Docker deployment as a reserved packaging path, not as a checked-in turnkey deployment.

## Validation

From the repository root, run the full workspace checks before changing deployment or shared contracts:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The server package itself has type checking but no package-level test script; use the two smoke scripts above for the current runtime and password checks.
