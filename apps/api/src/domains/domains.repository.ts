import { SQL } from 'bun'
import { db } from '../db/client'
import { Exception } from '../util'

export interface DomainRow {
  id: number
  host: string
  scheme: 'http' | 'https'
  created_at: Date
}

export class DomainConflictException extends Exception {
  constructor() {
    super('E_DOMAIN_CONFLICT', 'domain already registered', 409)
  }
}
export class DomainInUseException extends Exception {
  constructor() {
    super('E_DOMAIN_IN_USE', 'domain still has links', 409)
  }
}

export async function listDomains(): Promise<DomainRow[]> {
  return db<DomainRow[]>`SELECT * FROM domains ORDER BY host`
}

export async function findDomainById(id: number): Promise<DomainRow | undefined> {
  const [row] = await db<[DomainRow]>`SELECT * FROM domains WHERE id = ${id} LIMIT 1`
  return row
}

export async function insertDomain(host: string, scheme: 'http' | 'https'): Promise<number> {
  try {
    const result = await db`INSERT INTO domains (host, scheme) VALUES (${host}, ${scheme})`
    return Number(result.lastInsertRowid)
  } catch (error) {
    if (error instanceof SQL.MySQLError && error.errno === 1062) throw new DomainConflictException()
    throw error
  }
}

// Returns whether a row was deleted. The FK on links.domain_id (ON DELETE RESTRICT) is the
// authority on "domain has links" — errno 1451 — so there is no check-then-delete race.
export async function removeDomain(id: number): Promise<boolean> {
  try {
    const result = await db`DELETE FROM domains WHERE id = ${id}`
    return result.affectedRows > 0
  } catch (error) {
    if (error instanceof SQL.MySQLError && error.errno === 1451) throw new DomainInUseException()
    throw error
  }
}
