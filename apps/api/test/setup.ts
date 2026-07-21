// Preloaded by `bun test` (see ../bunfig.toml) before any test file imports run. Fills in
// defaults for the env vars `env.ts` requires at import time, so the suite doesn't depend on a
// developer's local `apps/api/.env` and stays hermetic in CI. `??=` lets a real `.env` (if
// present) win, since Bun loads `.env` before running this preload script.
process.env.LOG_LEVEL ??= 'silent'
process.env.JWKS_URI ??= 'https://example.test/jwks'
process.env.JWK_ISSUER ??= 'https://example.test'
process.env.AUDIENCE ??= 'shurl-test'
process.env.JWT_ROLE_CLAIM ??= 'resource_access.shurl.roles'
process.env.DATABASE_URL ??= 'mysql://test:test@localhost:3306/test'
process.env.REDIS_URL ??= 'redis://localhost:6379'
process.env.CORS_ORIGIN ??= 'http://localhost:5173'
