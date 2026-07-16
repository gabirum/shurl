import { Glob, sql } from 'bun'
import { logger } from './logger'

const migrationsDir = `${import.meta.dir}/db/migrations`

export async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `

  const files = [...new Glob('*.sql').scanSync({ cwd: migrationsDir })].sort()
  await sql.begin(async tx => {
    for (const name of files) {
      const [applied] = await tx`SELECT 1 FROM schema_migrations WHERE name = ${name}`
      if (applied) continue
      await tx.file(`${migrationsDir}/${name}`)
      await tx`INSERT INTO schema_migrations (name) VALUES (${name})`
      logger.info({ migration: name }, 'applied database migration')
    }
  })
}
