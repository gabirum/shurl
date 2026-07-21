import { describe, expect, test } from 'bun:test'
import { createPage, createSlice } from './util'

describe('createSlice', () => {
  test('marks a full page as not last, with a next slice available', () => {
    const slice = createSlice([1, 2, 3], 2, 1)
    expect(slice).toEqual({ data: [1, 2], isFirst: true, isLast: false, hasNext: true, hasPrevious: false })
  })

  test('marks a short final page as last, with no next slice', () => {
    const slice = createSlice([1], 2, 2)
    expect(slice).toEqual({ data: [1], isFirst: false, isLast: true, hasNext: false, hasPrevious: true })
  })

  test('handles an empty result as the last page', () => {
    const slice = createSlice([], 2, 1)
    expect(slice.isLast).toBe(true)
    expect(slice.hasNext).toBe(false)
  })
})

describe('createPage', () => {
  test('reports a coherent empty page instead of totalPages: 0', () => {
    const page = createPage([], 20, 1, 0)
    expect(page.totalPages).toBe(1)
    expect(page.isLast).toBe(true)
    expect(page.hasNext).toBe(false)
    expect(page.hasPrevious).toBe(false)
  })

  test('marks the last page of a multi-page result as last', () => {
    const page = createPage([1, 2], 2, 2, 4)
    expect(page.totalPages).toBe(2)
    expect(page.isLast).toBe(true)
    expect(page.hasNext).toBe(false)
    expect(page.hasPrevious).toBe(true)
  })

  test('stays coherent when the requested page is beyond the end', () => {
    const page = createPage([], 2, 5, 4)
    expect(page.totalPages).toBe(2)
    expect(page.isLast).toBe(true)
    expect(page.hasNext).toBe(false)
  })

  test('marks a middle page as neither first nor last', () => {
    const page = createPage([3, 4], 2, 2, 6)
    expect(page.isFirst).toBe(false)
    expect(page.isLast).toBe(false)
    expect(page.hasNext).toBe(true)
    expect(page.hasPrevious).toBe(true)
  })
})
