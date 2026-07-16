import { recordHit } from './links.counter'
import type { LinkRow } from './links.repository'
import * as repo from './links.repository'
import type { CreateLinkInput, PaginationInput, UpdateLinkInput } from './links.schema'
import { PERMANENT_REDIRECT_STATUS } from './links.schema'
import type { Page } from '../util'
import { createPage } from '../util'
import { logger } from '../logger'

export class LinkNotFoundError extends Error {}
export class LinkImmutableError extends Error {}

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
    return (await repo.findByCode(input.code))!
  }

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const code = generateCode()
    try {
      await repo.insertLink({ ...newLink, code })
      logger.info({ owner, code, redirectStatus: input.redirectStatus }, 'link created')
      return (await repo.findByCode(code))!
    } catch (error) {
      if (error instanceof repo.CodeConflictError) continue
      throw error
    }
  }
  throw new Error('failed to generate a unique code after multiple attempts')
}

async function getOwned(owner: string, code: string): Promise<LinkRow> {
  const row = await repo.findByCode(code)
  if (!row || row.owner !== owner) throw new LinkNotFoundError(code)
  return row
}

export function get(owner: string, code: string): Promise<LinkRow> {
  return getOwned(owner, code)
}

export async function list(owner: string, pagination: PaginationInput): Promise<Page<LinkRow>> {
  const { page, size } = pagination
  const [rows, totalElements] = await Promise.all([
    repo.listByOwner(owner, (page - 1) * size, size),
    repo.countByOwner(owner),
  ])
  return createPage(rows, size, page, totalElements)
}

export async function update(owner: string, code: string, patch: UpdateLinkInput): Promise<LinkRow> {
  const row = await getOwned(owner, code)
  if (row.redirect_status === PERMANENT_REDIRECT_STATUS) throw new LinkImmutableError(code)
  await repo.updateLink(code, { url: patch.url, redirectStatus: patch.redirectStatus })
  logger.info({ owner, code, patch }, 'link updated')
  return getOwned(owner, code)
}

export async function remove(owner: string, code: string): Promise<void> {
  const row = await getOwned(owner, code)
  if (row.redirect_status === PERMANENT_REDIRECT_STATUS) throw new LinkImmutableError(code)
  await repo.removeLink(code)
  logger.info({ owner, code }, 'link removed')
}

export async function resolve(code: string): Promise<LinkRow | undefined> {
  const row = await repo.findByCode(code)
  if (!row) return undefined
  recordHit(code)
  logger.debug({ code }, 'link resolved')
  return row
}
