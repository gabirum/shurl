import { bumpAccessCounts } from './links.repository'
import { logger } from '../logger'

const FLUSH_INTERVAL_MS = 5000

let pending = new Map<number, number>()
let flushing = false

export function recordHit(linkId: number): void {
  pending.set(linkId, (pending.get(linkId) ?? 0) + 1)
}

export async function flushNow(): Promise<void> {
  if (flushing || pending.size === 0) return
  flushing = true
  const hits = pending
  pending = new Map<number, number>()
  try {
    await bumpAccessCounts(hits)
    logger.debug({ count: hits.size }, 'flushed link access counts')
  } catch (error) {
    for (const [id, count] of pending) hits.set(id, (hits.get(id) ?? 0) + count)
    pending = hits
    logger.error({ err: error }, 'failed to flush link access counts')
  } finally {
    flushing = false
  }
}

const interval = setInterval(flushNow, FLUSH_INTERVAL_MS)
interval.unref()
