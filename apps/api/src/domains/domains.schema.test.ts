import { describe, expect, test } from 'bun:test'
import { createDomainSchema } from './domains.schema'

describe('createDomainSchema', () => {
  test('normalizes host to lowercase and defaults scheme to https', () => {
    const result = createDomainSchema.parse({ host: ' SH.Example.COM ' })
    expect(result).toEqual({ host: 'sh.example.com', scheme: 'https' })
  })

  test('accepts host with port', () => {
    expect(createDomainSchema.safeParse({ host: '127.0.0.1:3000', scheme: 'http' }).success).toBe(true)
  })

  test('rejects the admin host (test setup sets ADMIN_HOST=admin.example.com)', () => {
    expect(createDomainSchema.safeParse({ host: 'admin.example.com' }).success).toBe(false)
  })

  test.each(['https://sh.example.com', 'sh.example.com/path', 'sh example.com', '-bad.com', ''])(
    'rejects malformed host %p',
    host => {
      expect(createDomainSchema.safeParse({ host }).success).toBe(false)
    },
  )
})
