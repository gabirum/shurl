import { getCachedLink, invalidateLink, setCachedLink } from './links.cache'
import { recordHit } from './links.counter'
import type { LinkRow } from './links.repository'
import * as repo from './links.repository'
import type { CreateLinkInput, PaginationInput, UpdateLinkInput } from './links.schema'
import type { Page } from '../util'
import { createPage, Exception } from '../util'
import { logger } from '../logger'

export class LinkNotFoundException extends Exception {
  constructor() {
    super('E_NOT_FOUND', 'link not found', 404)
  }
}
export class LinkImmutableException extends Exception {
  constructor() {
    super('E_LINK_IMMUTABLE', 'permanent links cannot be modified', 409)
  }
}
export class CodeGenerationExhaustedException extends Exception {
  constructor() {
    super('E_CODE_GENERATION', 'failed to generate a unique code after multiple attempts', 503)
  }
}

export const CODE_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
export const CODE_LENGTH = 7
const MAX_GENERATION_ATTEMPTS = 5

export function generateCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)
  let code = ''
  for (const byte of bytes) code += CODE_ALPHABET[byte % CODE_ALPHABET.length]
  return code
}

export async function create(owner: string, input: CreateLinkInput, ownerUsername?: string): Promise<LinkRow> {
  const { domainId } = input
  const newLink = { owner, ownerUsername, domainId, url: input.url, redirectStatus: input.redirectStatus }

  const insert = async (code: string): Promise<LinkRow> => {
    const id = await repo.insertLink({ ...newLink, code })
    logger.info({ owner, id, domainId, code, redirectStatus: input.redirectStatus }, 'link created')
    const row = await repo.findById(id)
    if (!row) throw new LinkNotFoundException()
    await setCachedLink(domainId, code, row)
    return row
  }

  if (input.code) return insert(input.code)

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    try {
      return await insert(generateCode())
    } catch (error) {
      if (error instanceof repo.CodeConflictException) continue
      throw error
    }
  }
  throw new CodeGenerationExhaustedException()
}

async function getOwned(owner: string, id: number): Promise<LinkRow> {
  const row = await repo.findById(id)
  if (!row || row.owner !== owner) throw new LinkNotFoundException()
  return row
}

export async function get(owner: string, id: number, isAdmin = false): Promise<LinkRow> {
  if (!isAdmin) return getOwned(owner, id)
  const row = await repo.findById(id)
  if (!row) throw new LinkNotFoundException()
  return row
}

export async function list(owner: string, pagination: PaginationInput, isAdmin = false): Promise<Page<LinkRow>> {
  const { page, size } = pagination
  const [rows, totalElements] = isAdmin
    ? await Promise.all([repo.listAll((page - 1) * size, size), repo.countAll()])
    : await Promise.all([repo.listByOwner(owner, (page - 1) * size, size), repo.countByOwner(owner)])
  return createPage(rows, size, page, totalElements)
}

// A conditional write (with owner + 308 guards in its WHERE) reporting no rows affected is
// ambiguous: the row may be gone, owned by someone else, or immutable. Re-read to map it to the
// right status — 404 for missing/not-owned (never leak existence to a non-owner), 409 for 308.
// `ownerScope: null` (admin) means only "gone" vs "immutable" remain possible.
async function explainNoop(id: number, ownerScope: string | null): Promise<never> {
  const row = await repo.findById(id)
  if (!row || (ownerScope !== null && row.owner !== ownerScope)) throw new LinkNotFoundException()
  throw new LinkImmutableException()
}

export async function update(owner: string, id: number, patch: UpdateLinkInput, isAdmin = false): Promise<LinkRow> {
  const ownerScope = isAdmin ? null : owner
  const updated = await repo.updateLink(id, ownerScope, { url: patch.url, redirectStatus: patch.redirectStatus })
  if (!updated) await explainNoop(id, ownerScope)
  const row = await get(owner, id, isAdmin)
  logger.info({ actor: owner, owner: row.owner, id, patch }, 'link updated')
  await setCachedLink(row.domain_id, row.code, row)
  return row
}

export async function remove(owner: string, id: number, isAdmin = false): Promise<void> {
  const ownerScope = isAdmin ? null : owner
  // Read first: the cache key (domain + code) is only known from the row, and it's gone after the delete.
  const existing = await repo.findById(id)
  const removed = await repo.removeLink(id, ownerScope)
  if (!removed) await explainNoop(id, ownerScope)
  if (existing) await invalidateLink(existing.domain_id, existing.code)
  logger.info({ actor: owner, id }, 'link removed')
}

export async function resolve(domainId: number, code: string): Promise<LinkRow | undefined> {
  const cached = await getCachedLink(domainId, code)
  if (cached !== undefined) {
    if (cached) recordHit(cached.id)
    logger.debug({ domainId, code, cacheHit: true }, 'link resolved')
    return cached ?? undefined
  }

  const row = await repo.findByDomainAndCode(domainId, code)
  await setCachedLink(domainId, code, row ?? null)
  if (!row) return undefined
  recordHit(row.id)
  logger.debug({ domainId, code }, 'link resolved')
  return row
}
