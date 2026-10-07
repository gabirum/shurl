import { describe, expect, mock, test } from 'bun:test'
import type { LinkRow } from './links.repository'

// In-memory stand-in for the `links` table, keyed by id. Mirrors the WHERE-clause semantics of
// the real updateLink/removeLink (see links.repository.ts): a null ownerScope means "any owner"
// (admin), and a 308 row can never be touched by either write, admin or not.
const rows = new Map<number, LinkRow>()

function seed(row: LinkRow): void {
  rows.set(row.id, row)
}

function makeRow(overrides: Partial<LinkRow>): LinkRow {
  const now = new Date('2026-01-01T00:00:00.000Z')
  return {
    id: 1,
    domain_id: 1,
    domain_host: 'sh.example.com',
    domain_scheme: 'https',
    code: 'abc1234',
    target_url: 'https://example.com',
    redirect_status: 302,
    owner: 'owner-1',
    owner_username: 'owner-one',
    access_count: 0,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

const findById = mock(async (id: number) => rows.get(id))

const updateLink = mock(
  async (id: number, ownerScope: string | null, patch: { url?: string; redirectStatus?: 302 | 307 | 308 }) => {
    const row = rows.get(id)
    if (!row) return false
    if (ownerScope !== null && row.owner !== ownerScope) return false
    if (row.redirect_status === 308) return false
    rows.set(id, {
      ...row,
      target_url: patch.url ?? row.target_url,
      redirect_status: patch.redirectStatus ?? row.redirect_status,
    })
    return true
  },
)

const removeLink = mock(async (id: number, ownerScope: string | null) => {
  const row = rows.get(id)
  if (!row) return false
  if (ownerScope !== null && row.owner !== ownerScope) return false
  if (row.redirect_status === 308) return false
  rows.delete(id)
  return true
})

// links.service imports these directly from links.repository/links.cache/links.counter, so the
// mocks must be registered before links.service is first imported (see links.counter.test.ts for
// the same pattern).
mock.module('./links.repository', () => ({
  findById,
  findByDomainAndCode: mock(async () => undefined),
  updateLink,
  removeLink,
  insertLink: mock(async () => {}),
  listByOwner: mock(async () => []),
  countByOwner: mock(async () => 0),
  listAll: mock(async () => []),
  countAll: mock(async () => 0),
  CodeConflictException: class CodeConflictException extends Error {},
}))
mock.module('./links.cache', () => ({
  getCachedLink: mock(async () => undefined),
  setCachedLink: mock(async () => {}),
  invalidateLink: mock(async () => {}),
}))
mock.module('./links.counter', () => ({ recordHit: mock(() => {}) }))

const { CODE_ALPHABET, CODE_LENGTH, generateCode, update, remove, LinkNotFoundException, LinkImmutableException } =
  await import('./links.service')

describe('generateCode', () => {
  test('generates codes of the expected length, drawn from the expected alphabet', () => {
    const alphabet = new Set(CODE_ALPHABET)
    for (let i = 0; i < 100; i++) {
      const code = generateCode()
      expect(code).toHaveLength(CODE_LENGTH)
      for (const char of code) expect(alphabet.has(char)).toBe(true)
    }
  })

  test('is not obviously deterministic', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateCode()))
    expect(codes.size).toBeGreaterThan(1)
  })
})

describe('update/remove authorization', () => {
  test('non-admin editing another owner’s link gets 404, not 403 (existence is never leaked)', async () => {
    rows.clear()
    seed(makeRow({ id: 11, code: 'other01', owner: 'owner-2' }))
    await expect(update('owner-1', 11, { url: 'https://new.example.com' })).rejects.toBeInstanceOf(
      LinkNotFoundException,
    )
  })

  test('admin can update a 302 link owned by someone else', async () => {
    rows.clear()
    seed(makeRow({ id: 12, code: 'other02', owner: 'owner-2', redirect_status: 302 }))
    const updated = await update('admin-1', 12, { url: 'https://new.example.com' }, true)
    expect(updated.target_url).toBe('https://new.example.com')
    expect(updated.owner).toBe('owner-2')
  })

  test('admin cannot update a 308 link owned by someone else', async () => {
    rows.clear()
    seed(makeRow({ id: 13, code: 'other03', owner: 'owner-2', redirect_status: 308 }))
    await expect(update('admin-1', 13, { url: 'https://new.example.com' }, true)).rejects.toBeInstanceOf(
      LinkImmutableException,
    )
  })

  test('admin updating a nonexistent code gets 404', async () => {
    rows.clear()
    await expect(update('admin-1', 99, { url: 'https://new.example.com' }, true)).rejects.toBeInstanceOf(
      LinkNotFoundException,
    )
  })

  test('owner cannot update their own 308 link', async () => {
    rows.clear()
    seed(makeRow({ id: 17, code: 'own0308', owner: 'owner-1', redirect_status: 308 }))
    await expect(update('owner-1', 17, { url: 'https://new.example.com' })).rejects.toBeInstanceOf(
      LinkImmutableException,
    )
  })

  test('admin can remove a 302 link owned by someone else', async () => {
    rows.clear()
    seed(makeRow({ id: 14, code: 'other04', owner: 'owner-2', redirect_status: 302 }))
    await remove('admin-1', 14, true)
    expect(rows.has(14)).toBe(false)
  })

  test('admin cannot remove a 308 link owned by someone else', async () => {
    rows.clear()
    seed(makeRow({ id: 15, code: 'other05', owner: 'owner-2', redirect_status: 308 }))
    await expect(remove('admin-1', 15, true)).rejects.toBeInstanceOf(LinkImmutableException)
    expect(rows.has(15)).toBe(true)
  })

  test('non-admin removing another owner’s link gets 404', async () => {
    rows.clear()
    seed(makeRow({ id: 16, code: 'other06', owner: 'owner-2' }))
    await expect(remove('owner-1', 16)).rejects.toBeInstanceOf(LinkNotFoundException)
    expect(rows.has(16)).toBe(true)
  })
})
