import { Glob, sql } from 'bun'
import { logger } from './logger'

const migrationsDir = `${import.meta.dir}/db/migrations`

// Named lock, not a schema_migrations row lock: it must be held before the table
// is even known to exist, so that horizontally-scaled instances booting in
// parallel don't race each other to create it / apply the same migration twice.
const MIGRATION_LOCK_NAME = 'shurl_migrations'
const MIGRATION_LOCK_TIMEOUT_SECONDS = 30

export async function migrate() {
  // GET_LOCK/RELEASE_LOCK are session-scoped, so both calls (and everything in
  // between) must run on this same reserved connection rather than the pool.
  const reserved = await sql.reserve()

  try {
    const [{ acquired }] = await reserved`
      SELECT GET_LOCK(${MIGRATION_LOCK_NAME}, ${MIGRATION_LOCK_TIMEOUT_SECONDS}) AS acquired
    `
    if (acquired !== 1) {
      throw new Error(
        `failed to acquire migration lock '${MIGRATION_LOCK_NAME}' after ${MIGRATION_LOCK_TIMEOUT_SECONDS}s`,
      )
    }

    try {
      await reserved`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          name       VARCHAR(255) NOT NULL PRIMARY KEY,
          applied_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `

      // Not wrapped in a transaction: MySQL DDL implicit-commits, so `begin(...)` here would
      // give no real atomicity anyway — it would just make a mid-file failure on a
      // multi-statement migration look uncommitted when the DDL already landed, causing a
      // re-run to fail (e.g. "table already exists") since schema_migrations was rolled back
      // but the schema change wasn't. Every migration file must therefore be either
      // idempotent (`IF NOT EXISTS` / `IF EXISTS`) or a single statement, so a failure never
      // leaves partial, unrecorded DDL applied.
      const files = Array.from(new Glob('*.sql').scanSync({ cwd: migrationsDir })).sort()
      for (const name of files) {
        const [applied] = await reserved`SELECT 1 FROM schema_migrations WHERE name = ${name}`
        if (applied) continue
        await reserved.file(`${migrationsDir}/${name}`)
        await reserved`INSERT INTO schema_migrations (name) VALUES (${name})`
        logger.info({ migration: name }, 'applied database migration')
      }
    } finally {
      await reserved`SELECT RELEASE_LOCK(${MIGRATION_LOCK_NAME})`
    }
  } finally {
    reserved.release()
  }
}
