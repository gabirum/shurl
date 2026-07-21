import { describe, expect, mock, test } from 'bun:test'

let rejectFlush: (error: Error) => void
const bumpAccessCounts = mock(
  () =>
    new Promise<void>((_resolve, reject) => {
      rejectFlush = reject
    }),
)

// links.counter imports bumpAccessCounts from links.repository directly, so the mock must be
// registered before links.counter is first imported.
mock.module('./links.repository', () => ({ bumpAccessCounts }))
const { recordHit, flushNow } = await import('./links.counter')

describe('flushNow', () => {
  test('merges hits recorded during a failed flush instead of discarding them', async () => {
    recordHit('abc') // this hit is captured into the batch sent to the failing flush below
    const flushPromise = flushNow()

    recordHit('abc') // recorded while the flush above is in flight and about to fail

    rejectFlush(new Error('boom'))
    await flushPromise

    bumpAccessCounts.mockImplementation(async () => {})
    await flushNow()

    expect(bumpAccessCounts).toHaveBeenLastCalledWith(new Map([['abc', 2]]))
  })
})
