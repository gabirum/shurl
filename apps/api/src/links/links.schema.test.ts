import { describe, expect, test } from 'bun:test'
import { createLinkSchema, updateLinkSchema } from './links.schema'

describe('createLinkSchema', () => {
  test('accepts a valid https URL', () => {
    const result = createLinkSchema.safeParse({ url: 'https://example.com/path', redirectStatus: 302 })
    expect(result.success).toBe(true)
  })

  test('rejects a javascript: URL', () => {
    const result = createLinkSchema.safeParse({ url: 'javascript:alert(1)', redirectStatus: 302 })
    expect(result.success).toBe(false)
  })

  test('rejects a data: URL', () => {
    const result = createLinkSchema.safeParse({ url: 'data:text/html,<script>alert(1)</script>', redirectStatus: 302 })
    expect(result.success).toBe(false)
  })

  test('rejects a file: URL', () => {
    const result = createLinkSchema.safeParse({ url: 'file:///etc/passwd', redirectStatus: 302 })
    expect(result.success).toBe(false)
  })

  test('rejects a URL longer than 2048 characters', () => {
    const url = `https://example.com/${'a'.repeat(2048)}`
    const result = createLinkSchema.safeParse({ url, redirectStatus: 302 })
    expect(result.success).toBe(false)
  })

  test('rejects a redirect status outside 302/307/308', () => {
    const result = createLinkSchema.safeParse({ url: 'https://example.com', redirectStatus: 301 })
    expect(result.success).toBe(false)
  })
})

describe('updateLinkSchema', () => {
  test('accepts a url-only patch', () => {
    expect(updateLinkSchema.safeParse({ url: 'https://example.com/new' }).success).toBe(true)
  })

  test('accepts a redirectStatus-only patch', () => {
    expect(updateLinkSchema.safeParse({ redirectStatus: 307 }).success).toBe(true)
  })

  test('rejects an empty patch', () => {
    expect(updateLinkSchema.safeParse({}).success).toBe(false)
  })

  test('rejects a javascript: URL in a patch', () => {
    expect(updateLinkSchema.safeParse({ url: 'javascript:alert(1)' }).success).toBe(false)
  })
})
