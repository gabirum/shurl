import { describe, expect, test } from 'bun:test'
import { CODE_ALPHABET, CODE_LENGTH, generateCode } from './links.service'

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
