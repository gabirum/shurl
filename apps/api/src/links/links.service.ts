import { getCachedLink, invalidateLink, setCachedLink } from './links.cache'
import { recordHit } from './links.counter'
import type { LinkRow } from './links.repository'
import * as repo from './links.repository'
import type { CreateLinkInput, PaginationInput, UpdateLinkInput } from './links.schema'
import { PERMANENT_REDIRECT_STATUS } from './links.schema'
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

const CODE_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const CODE_LENGTH = 7
const MAX_GENERATION_ATTEMPTS = 5

function generateCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)
  let code = ''
  for (const byte of bytes) code += CODE_ALPHABET[byte % CODE_ALPHABET.length]
  return code
}

export async function create(owner: string, input: CreateLinkInput): Promise<LinkRow> {
  const newLink = { owner, url: input.url, redirectStatus: input.redirectStatus }

  if (input.code) {
    await repo.insertLink({ ...newLink, code: input.code })
    logger.info({ owner, code: input.code, redirectStatus: input.redirectStatus }, 'link created')
    const row = (await repo.findByCode(input.code))!
    await setCachedLink(input.code, row)
    return row
  }

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const code = generateCode()
    try {
      await repo.insertLink({ ...newLink, code })
      logger.info({ owner, code, redirectStatus: input.redirectStatus }, 'link created')
      const row = (await repo.findByCode(code))!
      await setCachedLink(code, row)
      return row
    } catch (error) {
      if (error instanceof repo.CodeConflictException) continue
      throw error
    }
  }
  throw new Error('failed to generate a unique code after multiple attempts')
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

export async function update(owner: string, code: string, patch: UpdateLinkInput): Promise<LinkRow> {
  const row = await getOwned(owner, code)
  if (row.redirect_status === PERMANENT_REDIRECT_STATUS) throw new LinkImmutableException()
  await repo.updateLink(code, { url: patch.url, redirectStatus: patch.redirectStatus })
  logger.info({ owner, code, patch }, 'link updated')
  const updated = await getOwned(owner, code)
  await setCachedLink(code, updated)
  return updated
}

export async function remove(owner: string, code: string): Promise<void> {
  const row = await getOwned(owner, code)
  if (row.redirect_status === PERMANENT_REDIRECT_STATUS) throw new LinkImmutableException()
  await repo.removeLink(code)
  await invalidateLink(code)
  logger.info({ owner, code }, 'link removed')
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
