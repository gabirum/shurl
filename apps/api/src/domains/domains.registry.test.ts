import { describe, expect, mock, test } from 'bun:test'
import type { DomainRow } from './domains.repository'

const now = new Date('2026-01-01T00:00:00.000Z')
let rows: DomainRow[] = [{ id: 1, host: 'sh.example.com', scheme: 'https', created_at: now }]

mock.module('./domains.repository', () => ({ listDomains: mock(async () => rows) }))
const { findDomainByHost, refreshDomains } = await import('./domains.registry')

describe('domain registry', () => {
  test('resolves hosts only after a refresh and forgets removed domains', async () => {
    expect(findDomainByHost('sh.example.com')).toBeUndefined()
    await refreshDomains()
    expect(findDomainByHost('sh.example.com')?.id).toBe(1)
    expect(findDomainByHost('other.example.com')).toBeUndefined()

    rows = []
    await refreshDomains()
    expect(findDomainByHost('sh.example.com')).toBeUndefined()
  })
})
