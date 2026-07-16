import { bumpAccessCounts } from './links.repository'
import { logger } from '../logger'

const FLUSH_INTERVAL_MS = 5000

const pending = new Map<string, number>()
let flushing = false

export function recordHit(code: string): void {
  pending.set(code, (pending.get(code) ?? 0) + 1)
}

export async function flushNow(): Promise<void> {
  if (flushing || pending.size === 0) return
  flushing = true
  const hits: [string, number][] = [...pending.entries()]
  pending.clear()
  try {
    await bumpAccessCounts(hits)
    logger.debug({ count: hits.length }, 'flushed link access counts')
  } catch (error) {
    for (const [code, count] of hits) {
      pending.set(code, (pending.get(code) ?? 0) + count)
    }
    logger.error({ err: error }, 'failed to flush link access counts')
  } finally {
    flushing = false
  }
}

const interval = setInterval(flushNow, FLUSH_INTERVAL_MS)
interval.unref()
