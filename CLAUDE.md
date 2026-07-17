# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`shurl` is a URL shortener service with a package-by-feature architecture (see `src/links/`). Persistence uses **`Bun.sql` directly (MySQL) — no ORM**; vendor lock-in to Bun/MySQL is an accepted tradeoff. Prefer Bun/Web-standard built-ins (`Bun.sql`, `Glob`, `crypto.getRandomValues`, `setInterval`) over adding new dependencies.

## Commands

This project uses **Bun**, not Node/npm.

- Install dependencies: `bun install`
- Run dev server (hot reload): `bun run dev` — serves on http://localhost:3000
- Lint: `bun run lint` (ESLint over `.ts` files)
- Format: `bun run write` (Prettier, writes in place)

There is no test suite or build script defined yet.

### Docker

- `docker-compose.yaml` runs the app (via `Dockerfile.dev`) alongside a MySQL database, with a file-watch sync of `./src`.
- `Dockerfile` is the production image: installs with `--production`, copies `src`, runs as the `bun` user, entrypoint `bun run index.ts`.
- `Dockerfile.dev` installs full deps and runs `bun dev` as the `bun` user.

## Architecture

- `src/env.ts` validates required environment variables at startup using a Zod schema (`envSchema`). If validation fails, it logs the error and calls `process.exit(1)`. Any new required env var must be added to this schema (and to `.env.example`) or the app will refuse to boot.
- `src/index.ts` builds the Hono app and wires global middleware, applied in this order: `requestId` → request logging (custom, logs method/path/status/duration via `logger`, level based on status code) → `cors` → `poweredBy` → `secureHeaders` → `prettyJSON` → Prometheus metrics registration.
  - `/auth/*` routes are protected by JWK-based JWT verification (`hono/jwk`), configured from `JWKS_URI`, `AUDIENCE`, and `JWK_ISSUER`. The verified payload is available as `c.get('jwtPayload')` (typed via `JwtVariables` from `hono/jwt`).
  - `/metrics` is protected by IP allowlisting (`hono/ip-restriction`, restricted to loopback and private ranges — no token) and serves Prometheus metrics via `@hono/prometheus` (registered with `collectDefaultMetrics: true`).
  - `/auth/links/*` (management, requires JWT) and `/c/:code` (public redirect) are mounted from `src/links/links.routes.ts`.
  - `await migrate()` runs before `export default app`, so the database schema is applied on every boot before the server starts accepting requests.
  - The global `onError` handler is the single place HTTP status codes get decided for errors: `HTTPException` (framework/validation errors) responds via its own `getResponse()`; any `Exception` (see `src/util.ts` below) is serialized as `{ code, message }` with its `suggestedStatus`; anything else is logged via `logger.error` and answered with a generic `{ code: 'E_INTERNAL', message: 'internal server error' }` 500.
- `src/db.ts` creates the shared `Bun.sql` client (`new SQL(env.DATABASE_URL)`) and exposes `migrate()`, which applies numbered `.sql` files from `src/db/migrations/` in order, tracking what's applied in a `schema_migrations` table (`sql.file()` runs each file; nothing is templated in TS). **To change the schema, add a new numbered migration file** — don't edit an applied one.
- `src/util.ts` defines `Exception`, the base class for all domain errors: `code` (a stable string like `E_NOT_FOUND`), `message`, and `suggestedStatus` (the `ContentfulStatusCode` the global `onError` handler in `src/index.ts` should respond with). Domain errors are thrown as dedicated subclasses with a fixed code/message/status baked into their constructor (e.g. `CodeConflictException` in `links.repository.ts`; `LinkNotFoundException`, `LinkImmutableException` in `links.service.ts`) rather than being constructed inline — this keeps error-to-HTTP-status mapping out of the routes/service call sites.
- `src/links/` (package-by-feature) implements the shortener:
  - `links.schema.ts` — Zod schemas/constants: allowed redirect statuses (`302 | 307 | 308`), the immutable status (`308`), and the short-code format.
  - `links.repository.ts` — the only module that touches `sql` for the `links` table (raw parameterized queries, no query builder). Duplicate-code inserts are detected via `SQL.MySQLError` with **`errno === 1062`** (Bun's MySQL adapter reports `error.code` as the generic `ERR_MYSQL_SERVER_ERROR`, not a MySQL-specific string like `ER_DUP_ENTRY` — the real MySQL error number is in `.errno`) and raised as `CodeConflictException`.
  - `links.service.ts` — business rules: short-code generation (random base62, retried on collision) or user-supplied alias, per-owner scoping (a link's `owner` is the JWT `sub`; access by a non-owner is treated as 404 via `LinkNotFoundException`, not 403, to avoid leaking existence), and **308 immutability** (update/delete on a `redirect_status = 308` row throws `LinkImmutableException` → HTTP 409).
  - `links.counter.ts` — the eventually-consistent access counter: hits accumulate in an in-memory `Map` (`recordHit`) and are flushed to MySQL every 5s (`setInterval`, unref'd) via a batched transaction; a failed flush puts the counts back for the next attempt.
  - `links.routes.ts` — two Hono routers: `managedLinks` (CRUD, mounted at `/auth/links`, already covered by the global JWK middleware) and `publicLinks` (`GET /:code` → `c.redirect(url, status)`, mounted at `/c`).

## Environment variables

Defined in `.env.example` / validated in `src/env.ts`: `LOG_LEVEL`, `JWKS_URI`, `JWK_ISSUER`, `AUDIENCE`, `DATABASE_URL` (must be a `mysql://` URL — used to construct the `Bun.sql` client in `src/db.ts`). `/metrics` is no longer gated by a token env var — it's IP-restricted instead (see Architecture above).

## Hono documentation

This project's web framework is Hono. For questions on its API (routing, context, middleware, helpers, adapters), fetch **https://hono.dev/llms-full.txt** — the complete framework documentation in a single LLM-friendly file. Prefer targeted `WebFetch` calls with a specific question over reading the whole file (it's ~360KB). The lighter https://hono.dev/llms-small.txt (core concepts only) is an alternative if the full file is more than needed; https://hono.dev/llms.txt is just a link index, not content, and generally not useful on its own.

## Conventions

- No semicolons, single quotes, no arrow-parens on single params, 120 print width (see `.prettierrc`).
- ESLint config (`eslint.config.mts`) extends `@eslint/js` recommended + `typescript-eslint` recommended.
- TypeScript `strict` mode is on; JSX (if used) uses `hono/jsx` as the JSX import source.
