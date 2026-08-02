import { sql, SQL } from 'bun'
import { PERMANENT_REDIRECT_STATUS } from './links.schema'
import { Exception } from '../util'

export interface LinkRow {
  code: string
  target_url: string
  redirect_status: 302 | 307 | 308
  owner: string
  owner_username: string | null
  access_count: number
  created_at: Date
  updated_at: Date
}

export class CodeConflictException extends Exception {
  constructor() {
    super('E_CODE_CONFLICT', 'code already in use', 409)
  }
}

export interface NewLink {
  code: string
  owner: string
  ownerUsername?: string
  url: string
  redirectStatus: 302 | 307 | 308
}

export async function insertLink(link: NewLink): Promise<void> {
  try {
    await sql`
      INSERT INTO links (code, target_url, redirect_status, owner, owner_username)
      VALUES (${link.code}, ${link.url}, ${link.redirectStatus}, ${link.owner}, ${link.ownerUsername ?? null})
    `
  } catch (error) {
    if (error instanceof SQL.MySQLError && error.errno === 1062) {
      throw new CodeConflictException()
    }
    throw error
  }
}

export async function findByCode(code: string): Promise<LinkRow | undefined> {
  const [link] = await sql<[LinkRow]>`SELECT * FROM links WHERE code = ${code} LIMIT 1`
  return link
}

export async function listByOwner(owner: string, offset: number, limit: number): Promise<LinkRow[]> {
  return sql<LinkRow[]>`
    SELECT * FROM links WHERE owner = ${owner} ORDER BY created_at DESC, code DESC LIMIT ${limit} OFFSET ${offset}
  `
}

export async function countByOwner(owner: string): Promise<number> {
  const [row] = await sql<[{ count: number }]>`SELECT COUNT(*) AS count FROM links WHERE owner = ${owner}`
  return Number(row.count)
}

export async function listAll(offset: number, limit: number): Promise<LinkRow[]> {
  return sql<LinkRow[]>`SELECT * FROM links ORDER BY created_at DESC, code DESC LIMIT ${limit} OFFSET ${offset}`
}

export async function countAll(): Promise<number> {
  const [row] = await sql<[{ count: number }]>`SELECT COUNT(*) AS count FROM links`
  return Number(row.count)
}

export interface LinkPatch {
  url?: string
  redirectStatus?: 302 | 307 | 308
}

// Returns whether a row was actually modified. Ownership and the 308-immutability guard are both
// in the WHERE clause so the write is atomic: it closes the check-then-act race where a concurrent
// request could flip a link to 308 between a prior read and this update, and it makes the function
// safe to call without a separate ownership pre-check (a 0-row result is then disambiguated into
// 404 vs 409 by the caller — see links.service.ts's explainNoop).
//
// `ownerScope` is `null` for admin writes — COALESCE(NULL, owner) collapses the predicate to
// `owner = owner` (always true, the column is NOT NULL), so a single parameterized clause covers
// both "must match this owner" and "any owner" without duplicating the three patch branches.
export async function updateLink(code: string, ownerScope: string | null, patch: LinkPatch): Promise<boolean> {
  let result
  if (patch.url !== undefined && patch.redirectStatus !== undefined) {
    result = await sql`
      UPDATE links SET target_url = ${patch.url}, redirect_status = ${patch.redirectStatus}, updated_at = CURRENT_TIMESTAMP
      WHERE code = ${code} AND owner = COALESCE(${ownerScope}, owner) AND redirect_status <> ${PERMANENT_REDIRECT_STATUS}
    `
  } else if (patch.url !== undefined) {
    result = await sql`
      UPDATE links SET target_url = ${patch.url}, updated_at = CURRENT_TIMESTAMP
      WHERE code = ${code} AND owner = COALESCE(${ownerScope}, owner) AND redirect_status <> ${PERMANENT_REDIRECT_STATUS}
    `
  } else if (patch.redirectStatus !== undefined) {
    result = await sql`
      UPDATE links SET redirect_status = ${patch.redirectStatus}, updated_at = CURRENT_TIMESTAMP
      WHERE code = ${code} AND owner = COALESCE(${ownerScope}, owner) AND redirect_status <> ${PERMANENT_REDIRECT_STATUS}
    `
  } else {
    return true
  }
  return result.affectedRows > 0
}

// Same atomicity reasoning as updateLink: the guard prevents deleting a link that became
// immutable, or that belongs to another owner, after the caller's last read. `ownerScope: null`
// means "any owner" (admin), same COALESCE trick as updateLink.
export async function removeLink(code: string, ownerScope: string | null): Promise<boolean> {
  const result = await sql`
    DELETE FROM links
    WHERE code = ${code} AND owner = COALESCE(${ownerScope}, owner) AND redirect_status <> ${PERMANENT_REDIRECT_STATUS}
  `
  return result.affectedRows > 0
}

export async function bumpAccessCounts(hits: Map<string, number>): Promise<void> {
  if (hits.size === 0) return
  await sql.begin(async tx => {
    for (const [code, count] of hits) {
      await tx`UPDATE links SET access_count = access_count + ${count} WHERE code = ${code}`
    }
  })
}
