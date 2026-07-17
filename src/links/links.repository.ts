import { sql, SQL } from 'bun'
import { Exception } from '../util'

export interface LinkRow {
  code: string
  target_url: string
  redirect_status: 302 | 307 | 308
  owner: string
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
  url: string
  redirectStatus: 302 | 307 | 308
}

export async function insertLink(link: NewLink): Promise<void> {
  try {
    await sql`
      INSERT INTO links (code, target_url, redirect_status, owner)
      VALUES (${link.code}, ${link.url}, ${link.redirectStatus}, ${link.owner})
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
    SELECT * FROM links WHERE owner = ${owner} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
  `
}

export async function countByOwner(owner: string): Promise<number> {
  const [row] = await sql<[{ count: number }]>`SELECT COUNT(*) AS count FROM links WHERE owner = ${owner}`
  return Number(row.count)
}

export interface LinkPatch {
  url?: string
  redirectStatus?: 302 | 307 | 308
}

export async function updateLink(code: string, patch: LinkPatch): Promise<void> {
  if (patch.url !== undefined && patch.redirectStatus !== undefined) {
    await sql`
      UPDATE links SET target_url = ${patch.url}, redirect_status = ${patch.redirectStatus}, updated_at = CURRENT_TIMESTAMP
      WHERE code = ${code}
    `
  } else if (patch.url !== undefined) {
    await sql`UPDATE links SET target_url = ${patch.url}, updated_at = CURRENT_TIMESTAMP WHERE code = ${code}`
  } else if (patch.redirectStatus !== undefined) {
    await sql`UPDATE links SET redirect_status = ${patch.redirectStatus}, updated_at = CURRENT_TIMESTAMP WHERE code = ${code}`
  }
}

export async function removeLink(code: string): Promise<void> {
  await sql`DELETE FROM links WHERE code = ${code}`
}

export async function bumpAccessCounts(hits: [code: string, count: number][]): Promise<void> {
  if (hits.length === 0) return
  await sql.begin(async tx => {
    for (const [code, count] of hits) {
      await tx`UPDATE links SET access_count = access_count + ${count} WHERE code = ${code}`
    }
  })
}
