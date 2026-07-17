import { ContentfulStatusCode } from 'hono/utils/http-status'

export interface Slice<T> {
  data: T[]
  isFirst: boolean
  isLast: boolean
  hasNext: boolean
  hasPrevious: boolean
}

export interface Page<T> extends Slice<T> {
  totalPages: number
  totalElements: number
}

/**
 * Creates a slice of data that indicates whether there's a next or previous slice available.
 *
 * For this function to work as expected, the datasource must return the requestedSize + 1.
 *
 * @example
 * const rows = sql`SELECT * FROM table OFFSET ${requestedSize * requestedPage} LIMIT ${requestedSize + 1}`
 * const slice = createSlice(rows, requestedSize, requestedPage)
 * @param data data array
 * @param requestedSize user requested page size
 * @param requestedPage user requested page number
 * @returns the slice object
 */
export function createSlice<T>(data: T[], requestedSize: number, requestedPage: number): Slice<T> {
  return {
    data: data.slice(0, requestedSize),
    isFirst: requestedPage === 1,
    isLast: data.length < requestedSize,
    hasNext: data.length > requestedSize,
    hasPrevious: requestedPage > 1,
  }
}

/**
 * A page is a sublist of a list of objects. It allows gain information about the position of it in the containing entire list.
 * @param data data array
 * @param requestedSize user requested page size
 * @param requestedPage user requested page number
 * @param totalElements datasource element count
 * @returns the page object
 */
export function createPage<T>(data: T[], requestedSize: number, requestedPage: number, totalElements: number): Page<T> {
  const totalPages = Math.ceil(totalElements / requestedSize)
  return {
    data,
    isFirst: requestedPage === 1,
    isLast: requestedPage === totalPages,
    hasNext: requestedPage < totalPages,
    hasPrevious: requestedPage > 1,
    totalPages,
    totalElements,
  }
}

export class Exception extends Error {
  constructor(
    public readonly code: string = 'E_INTERNAL',
    message: string = 'internal server error',
    public readonly suggestedStatus: ContentfulStatusCode = 500,
    options?: ErrorOptions,
  ) {
    super(message, options)
  }
}
