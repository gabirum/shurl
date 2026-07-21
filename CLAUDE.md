# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`shurl` is a URL shortener service with a package-by-feature architecture (see `apps/api/src/links/`). Persistence uses **`Bun.sql` directly (MySQL) — no ORM**; vendor lock-in to Bun/MySQL/Redis is an accepted tradeoff. Prefer Bun/Web-standard built-ins (`Bun.sql`, `Bun.redis`, `Glob`, `crypto.getRandomValues`, `setInterval`) over adding new dependencies.

The repo is a **Bun workspaces monorepo** (`workspaces: ["apps/*"]` in the root `package.json`) with two apps today: `apps/api` (`@shurl/api`, the Hono backend) and `apps/web` (`@shurl/web`, the React frontend). New apps/services go under `apps/`; shared code, once there's more than one consumer, goes under `packages/` (doesn't exist yet — don't create it preemptively).

## Commands

This project uses **Bun**, not Node/npm.

- Install dependencies (from repo root): `bun install`
- Run dev server (hot reload): `bun run dev` — runs `bun run --filter '*' dev`, which fans out to each workspace package's `dev` script: `@shurl/api` (Hono, http://localhost:3000) and `@shurl/web` (Vite, http://localhost:5173). Bun's `--filter` accepts a workspace-name/path glob, so a specific app can be targeted directly, e.g. `bun run --filter '@shurl/web' dev`.
- Lint: `bun run lint` — runs `bun run --filter '*' lint`, fanning out to each workspace's own `lint` script. `@shurl/api` has no `eslint.config.*` of its own, so ESLint (invoked from `apps/api`) resolves the root `eslint.config.mts` by walking up. `@shurl/web` has its own `apps/web/eslint.config.js` (React/JSX-aware: hooks, fast-refresh, TanStack Query rules) which takes precedence over the root config for that workspace — don't try to fold web's rules into the root config, ESLint flat config only uses the nearest config file per directory, not a merge.
- Format: `bun run write` (Prettier, writes in place, repo-wide) — one shared `.prettierrc` at the repo root covers both apps; `apps/web` has no `.prettierrc` of its own.
- Build the frontend: `bun run --filter '@shurl/web' build` (`tsc -b && vite build`); `@shurl/api` has no build step (`bun run src/index.ts` runs the TS source directly).

There is no test suite defined yet.

### Docker

- `docker-compose.yaml` (at repo root) runs the app (via `apps/api/Dockerfile.dev`) alongside a MySQL database and a Redis instance, with a file-watch sync of `./apps/api/src`. The build `context` is the repo root (not `apps/api`) so the image can install from the root `bun.lock`/workspace `package.json` files.
- `apps/api/Dockerfile` is the production image: installs with `--production` from the root lockfile plus `apps/api/package.json`, copies `apps/api/src`, runs as the `bun` user, entrypoint `bun run src/index.ts` (cwd `apps/api`).
- `apps/api/Dockerfile.dev` installs full deps the same way and runs `bun dev` as the `bun` user (cwd `apps/api`).

## Architecture

- `apps/api/src/env.ts` validates required environment variables at startup using a Zod schema (`envSchema`). If validation fails, it logs the error and calls `process.exit(1)`. Any new required env var must be added to this schema (and to `apps/api/.env.example`) or the app will refuse to boot.
- `apps/api/src/index.ts` builds the Hono app and wires global middleware, applied in this order: `requestId` → request logging (custom, logs method/path/status/duration via `logger`, level based on status code) → `cors` → `poweredBy` → `secureHeaders` → `prettyJSON` → Prometheus metrics registration.
  - `/auth/*` routes are protected by JWK-based JWT verification (`hono/jwk`), configured from `JWKS_URI`, `AUDIENCE`, and `JWK_ISSUER`. The verified payload is available as `c.get('jwtPayload')` (typed via `JwtVariables` from `hono/jwt`).
  - `apps/api/src/auth.ts` implements RBAC on top of the verified JWT: `JWT_ROLE_CLAIM` (e.g. `resource_access.shurl.roles`) is a dot-delimited path resolved against the JWT payload to find the roles claim (`getRoles`), which may be a single string or an array of strings — providers differ (Keycloak nests roles per-client, others use a flat claim). `hasRole(payload, ADMIN_ROLE)` checks for the `admin` role. Any authenticated user can create/manage their own links; the `admin` role only grants read access across all owners (`GET /auth/links` and `GET /auth/links/{code}` bypass owner-scoping — see `links.routes.ts`'s `isAdmin` helper and `links.service.ts`'s `isAdmin` parameter). There is currently no admin write/delete-any-link capability.
  - `/metrics` is protected by IP allowlisting (`hono/ip-restriction`, restricted to loopback and private ranges — no token) and serves Prometheus metrics via `@hono/prometheus` (registered with `collectDefaultMetrics: true`).
  - `/auth/links/*` (management, requires JWT) and `/c/:code` (public redirect) are mounted from `apps/api/src/links/links.routes.ts`.
  - `await migrate()` runs before `export default app`, so the database schema is applied on every boot before the server starts accepting requests.
  - The global `onError` handler is the single place HTTP status codes get decided for errors: `HTTPException` (framework/validation errors) responds via its own `getResponse()`; any `Exception` (see `apps/api/src/util.ts` below) is serialized as `{ code, message }` with its `suggestedStatus`; anything else is logged via `logger.error` and answered with a generic `{ code: 'E_INTERNAL', message: 'internal server error' }` 500.
- `apps/api/src/db.ts` creates the shared `Bun.sql` client (`new SQL(env.DATABASE_URL)`) and exposes `migrate()`, which applies numbered `.sql` files from `apps/api/src/db/migrations/` (resolved via `import.meta.dir`, so it's independent of process cwd) in order, tracking what's applied in a `schema_migrations` table (`sql.file()` runs each file; nothing is templated in TS). **To change the schema, add a new numbered migration file** — don't edit an applied one.
- `apps/api/src/util.ts` defines `Exception`, the base class for all domain errors: `code` (a stable string like `E_NOT_FOUND`), `message`, and `suggestedStatus` (the `ContentfulStatusCode` the global `onError` handler in `apps/api/src/index.ts` should respond with). Domain errors are thrown as dedicated subclasses with a fixed code/message/status baked into their constructor (e.g. `CodeConflictException` in `links.repository.ts`; `LinkNotFoundException`, `LinkImmutableException` in `links.service.ts`) rather than being constructed inline — this keeps error-to-HTTP-status mapping out of the routes/service call sites.
- `apps/api/src/links/` (package-by-feature) implements the shortener:
  - `links.schema.ts` — Zod schemas/constants: allowed redirect statuses (`302 | 307 | 308`), the immutable status (`308`), and the short-code format.
  - `links.repository.ts` — the only module that touches `sql` for the `links` table (raw parameterized queries, no query builder). Duplicate-code inserts are detected via `SQL.MySQLError` with **`errno === 1062`** (Bun's MySQL adapter reports `error.code` as the generic `ERR_MYSQL_SERVER_ERROR`, not a MySQL-specific string like `ER_DUP_ENTRY` — the real MySQL error number is in `.errno`) and raised as `CodeConflictException`.
  - `links.service.ts` — business rules: short-code generation (random base62, retried on collision) or user-supplied alias, per-owner scoping (a link's `owner` is the JWT `sub`; access by a non-owner is treated as 404 via `LinkNotFoundException`, not 403, to avoid leaking existence), and **308 immutability** (update/delete on a `redirect_status = 308` row throws `LinkImmutableException` → HTTP 409).
  - `links.counter.ts` — the eventually-consistent access counter: hits accumulate in an in-memory `Map` (`recordHit`) and are flushed to MySQL every 5s (`setInterval`, unref'd) via a batched transaction; a failed flush puts the counts back for the next attempt.
  - `links.cache.ts` — two-tier cache for `resolve()`, the public redirect hot path: an in-process LRU (`Map`, capacity/TTL-bound, `L1_MAX_ENTRIES`/`L1_TTL_MS`) backed by a shared Redis tier (`Bun.redis`, the global singleton client, `L2_TTL_SECONDS`) so cache writes are visible across horizontally-scaled instances without waiting on L1 to expire. Caches both hits (`LinkRow`) and confirmed misses (`null`, to absorb code-guessing traffic) keyed by short code. `create`/`update` populate the cache with the fresh row; `remove` invalidates it. Redis errors on read/write/invalidate are caught and logged (`logger.warn`) rather than thrown — the cache is best-effort and callers fall back to `links.repository.ts`.
  - `links.routes.ts` — two Hono routers: `managedLinks` (CRUD, mounted at `/auth/links`, already covered by the global JWK middleware) and `publicLinks` (`GET /:code` → `c.redirect(url, status)`, mounted at `/c`).

### Frontend (`apps/web`)

React + Vite + TanStack Router/Query + `shadcn/ui` (Tailwind v4). File-based routing under `apps/web/src/routes/` (route tree is codegen'd to `apps/web/src/routeTree.gen.ts` by `@tanstack/router-plugin`'s Vite plugin — **gitignored, regenerated on every dev/build run, don't hand-edit it**). `_auth/*` routes are gated by `enforceLogin` in their route's `beforeLoad` (`apps/web/src/routes/_auth/route.tsx`).

- `apps/web/src/env.ts` reads config from `window.RUNTIME_ENV` first (for container/runtime injection, e.g. `${API_URL}`-style placeholders swapped at deploy time), falling back to Vite's build-time `import.meta.env.VITE_*` — see `getEnv`.
- `apps/web/src/oidc.ts` wraps `oidc-spa` (`oidcSpa.withExpectedDecodedIdTokenShape(...).createUtils()`), exporting `useOidc`/`getOidc`/`enforceLogin`/`OidcInitializationGate`. `VITE_OIDC_USE_MOCK=true` swaps in a mock implementation (`isUserInitiallyLoggedIn: true`, no real IdP) for local dev — mirror this when adding new auth-gated UI so it still works against the mock.
- `apps/web/src/api.ts` is a shared `ky` instance (`baseUrl: API_URL`) whose `beforeRequest` hook attaches `Authorization: Bearer <accessToken>` from `oidc-spa` when the user is logged in — new API calls should go through this instance rather than raw `fetch`.
- shadcn components live under `apps/web/src/components/ui/`; the `.claude/skills/shadcn` skill (project-local, only active under `apps/web/`) covers adding/customizing them — see `apps/web/components.json` and `apps/web/.mcp.json`.

## Environment variables

Defined in `apps/api/.env.example` / validated in `apps/api/src/env.ts`: `LOG_LEVEL`, `JWKS_URI`, `JWK_ISSUER`, `AUDIENCE`, `JWT_ROLE_CLAIM` (dot-delimited path to the roles claim in the JWT payload, e.g. `resource_access.shurl.roles` — see `apps/api/src/auth.ts`), `DATABASE_URL` (must be a `mysql://` URL — used to construct the `Bun.sql` client in `apps/api/src/db.ts`), `REDIS_URL` (`redis://`/`rediss://`/`valkey://` — read directly by the global `Bun.redis` client used in `links.cache.ts`, not passed through explicitly). `/metrics` is no longer gated by a token env var — it's IP-restricted instead (see Architecture above). Bun loads `.env` relative to process cwd, which for local `bun run dev` (via `--filter`) and for the Docker images is `apps/api` — so `.env` lives at `apps/api/.env`, not the repo root.

`apps/web` has its own env file, `apps/web/.env.local` (Vite convention — not `.env`, and gitignored via `*.local`; `apps/web/.env.example` documents the shape): `VITE_API_URL`, `VITE_OIDC_USE_MOCK`, `VITE_OIDC_ISSUER`, `VITE_OIDC_CLIENT_ID`. These are build-time fallbacks read by `apps/web/src/env.ts`'s `getEnv` when `window.RUNTIME_ENV` hasn't overridden them at runtime.

## Hono documentation

This project's web framework is Hono. For questions on its API (routing, context, middleware, helpers, adapters), fetch **https://hono.dev/llms-full.txt** — the complete framework documentation in a single LLM-friendly file. Prefer targeted `WebFetch` calls with a specific question over reading the whole file (it's ~360KB). The lighter https://hono.dev/llms-small.txt (core concepts only) is an alternative if the full file is more than needed; https://hono.dev/llms.txt is just a link index, not content, and generally not useful on its own.

## Conventions

- No semicolons, single quotes, no arrow-parens on single params, 120 print width (see root `.prettierrc`, shared by both apps).
- Root ESLint config (`eslint.config.mts`, used by `@shurl/api`) extends `@eslint/js` recommended + `typescript-eslint` recommended. `@shurl/web` has its own `apps/web/eslint.config.js` layering React Hooks/Fast Refresh/TanStack Query rules on top of the same base (see Commands above).
- TypeScript `strict` mode is on in both apps. JSX: `apps/api` uses `hono/jsx` as the JSX import source (for any server-rendered JSX); `apps/web` uses the standard `react-jsx` runtime.
