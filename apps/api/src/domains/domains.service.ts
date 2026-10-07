import { logger } from '../logger'
import { Exception } from '../util'
import * as repo from './domains.repository'
import { refreshDomains } from './domains.registry'
import type { CreateDomainInput } from './domains.schema'

export class DomainNotFoundException extends Exception {
  constructor() {
    super('E_DOMAIN_NOT_FOUND', 'domain not found', 404)
  }
}

export function list() {
  return repo.listDomains()
}

export async function create(input: CreateDomainInput) {
  const id = await repo.insertDomain(input.host, input.scheme)
  const row = await repo.findDomainById(id)
  if (!row) throw new DomainNotFoundException()
  await refreshDomains()
  logger.info({ id, host: input.host }, 'domain created')
  return row
}

export async function remove(id: number): Promise<void> {
  if (!(await repo.removeDomain(id))) throw new DomainNotFoundException()
  await refreshDomains()
  logger.info({ id }, 'domain removed')
}
