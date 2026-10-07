import { logger } from '../logger'
import type { DomainRow } from './domains.repository'
import { listDomains } from './domains.repository'

// In-memory host -> domain map so the per-request host dispatch (index.ts) never touches the
// database. Refreshed periodically so domains created/removed on another instance are picked
// up within REFRESH_INTERVAL_MS (accepted staleness window); local writes refresh immediately.
const REFRESH_INTERVAL_MS = 30_000

let byHost = new Map<string, DomainRow>()

export function findDomainByHost(host: string): DomainRow | undefined {
  return byHost.get(host)
}

export async function refreshDomains(): Promise<void> {
  const rows = await listDomains()
  byHost = new Map(rows.map(row => [row.host, row]))
}

export async function loadDomains(): Promise<void> {
  await refreshDomains()
  const interval = setInterval(() => {
    refreshDomains().catch(error => logger.error({ err: error }, 'failed to refresh domains'))
  }, REFRESH_INTERVAL_MS)
  interval.unref()
}
