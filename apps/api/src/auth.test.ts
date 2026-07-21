import { describe, expect, test } from 'bun:test'
import { ADMIN_ROLE, getRoles, hasRole } from './auth'

// getRoles/hasRole resolve JWT_ROLE_CLAIM (a dot-delimited path) against the payload, so build
// test payloads from whatever path is actually configured (test/setup.ts's default, or a
// developer's real apps/api/.env) instead of hardcoding one shape.
function payloadWithClaim(claim: unknown): unknown {
  const segments = process.env.JWT_ROLE_CLAIM!.split('.')
  return segments.reduceRight<unknown>((value, segment) => ({ [segment]: value }), claim)
}

describe('getRoles', () => {
  test('reads an array claim nested at the configured path', () => {
    expect(getRoles(payloadWithClaim(['admin', 'user']))).toEqual(['admin', 'user'])
  })

  test('wraps a single string claim in an array', () => {
    expect(getRoles(payloadWithClaim('admin'))).toEqual(['admin'])
  })

  test('returns an empty array when the claim path is absent', () => {
    expect(getRoles({})).toEqual([])
    expect(getRoles(payloadWithClaim(undefined))).toEqual([])
  })

  test('returns an empty array for non-object payloads', () => {
    expect(getRoles(null)).toEqual([])
    expect(getRoles('not an object')).toEqual([])
  })

  test('drops non-string entries from an array claim', () => {
    expect(getRoles(payloadWithClaim(['admin', 42, null]))).toEqual(['admin'])
  })
})

describe('hasRole', () => {
  test('is true when the role is present', () => {
    expect(hasRole(payloadWithClaim([ADMIN_ROLE, 'user']), ADMIN_ROLE)).toBe(true)
  })

  test('is false when the role is absent', () => {
    expect(hasRole(payloadWithClaim(['user']), ADMIN_ROLE)).toBe(false)
  })
})
