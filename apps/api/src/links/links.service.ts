import { getCachedLink, invalidateLink, setCachedLink } from './links.cache'
import { recordHit } from './links.counter'
import type { LinkRow } from './links.repository'
import * as repo from './links.repository'
import type { CreateLinkInput, PaginationInput, UpdateLinkInput } from './links.schema'
import { RESERVED_CODES } from './links.schema'
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
  let code: string
  do {
    const bytes = new Uint8Array(CODE_LENGTH)
    crypto.getRandomValues(bytes)
    code = ''
    for (const byte of bytes) code += CODE_ALPHABET[byte % CODE_ALPHABET.length]
    // Reserved codes (links.schema.ts) are real routes at the API root now that the redirect
    // lives there — vanishingly unlikely to roll one at random, but re-roll rather than issue
    // an unreachable link.
  } while (RESERVED_CODES.has(code.toLowerCase()))
  return code
}

export async function create(owner: string, input: CreateLinkInput, ownerUsername?: string): Promise<LinkRow> {
  const newLink = { owner, ownerUsername, url: input.url, redirectStatus: input.redirectStatus }

  if (input.code) {
    await repo.insertLink({ ...newLink, code: input.code })
    logger.info({ owner, code: input.code, redirectStatus: input.redirectStatus }, 'link created')
    const row = await repo.findByCode(input.code)
    if (!row) throw new LinkNotFoundException()
    await setCachedLink(input.code, row)
    return row
  }

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const code = generateCode()
    try {
      await repo.insertLink({ ...newLink, code })
      logger.info({ owner, code, redirectStatus: input.redirectStatus }, 'link created')
      const row = await repo.findByCode(code)
      if (!row) throw new LinkNotFoundException()
      await setCachedLink(code, row)
      return row
    } catch (error) {
      if (error instanceof repo.CodeConflictException) continue
      throw error
    }
  }
  throw new CodeGenerationExhaustedException()
}

async function getOwned(owner: string, code: string): Promise<LinkRow> {
  const row = await repo.findByCode(code)
  if (!row || row.owner !== owner) throw new LinkNotFoundException()
  return row
}

export async function get(owner: string, code: string, isAdmin = false): Promise<LinkRow> {
  if (!isAdmin) return getOwned(owner, code)
  const row = await repo.findByCode(code)
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
async function explainNoop(code: string, ownerScope: string | null): Promise<never> {
  const row = await repo.findByCode(code)
  if (!row || (ownerScope !== null && row.owner !== ownerScope)) throw new LinkNotFoundException()
  throw new LinkImmutableException()
}

export async function update(
  owner: string,
  code: string,
  patch: UpdateLinkInput,
  isAdmin = false,
): Promise<LinkRow> {
  const ownerScope = isAdmin ? null : owner
  const updated = await repo.updateLink(code, ownerScope, { url: patch.url, redirectStatus: patch.redirectStatus })
  if (!updated) await explainNoop(code, ownerScope)
  const row = await get(owner, code, isAdmin)
  logger.info({ actor: owner, owner: row.owner, code, patch }, 'link updated')
  await setCachedLink(code, row)
  return row
}

export async function remove(owner: string, code: string, isAdmin = false): Promise<void> {
  const ownerScope = isAdmin ? null : owner
  const removed = await repo.removeLink(code, ownerScope)
  if (!removed) await explainNoop(code, ownerScope)
  await invalidateLink(code)
  logger.info({ actor: owner, code }, 'link removed')
}

export async function resolve(code: string): Promise<LinkRow | undefined> {
  const cached = await getCachedLink(code)
  if (cached !== undefined) {
    if (cached) recordHit(code)
    logger.debug({ code, cacheHit: true }, 'link resolved')
    return cached ?? undefined
  }

  const row = await repo.findByCode(code)
  await setCachedLink(code, row ?? null)
  if (!row) return undefined
  recordHit(code)
  logger.debug({ code }, 'link resolved')
  return row
}
