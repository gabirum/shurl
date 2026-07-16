import { z } from 'zod'

export const REDIRECT_STATUSES = [302, 307, 308] as const
export const PERMANENT_REDIRECT_STATUS = 308

export const codeSchema = z.string().regex(/^[A-Za-z0-9_-]{1,32}$/, 'code must match [A-Za-z0-9_-]{1,32}')

export const createLinkSchema = z.object({
  url: z.url(),
  redirectStatus: z.literal(REDIRECT_STATUSES),
  code: codeSchema.optional(),
})

export const updateLinkSchema = z
  .object({ url: z.url().optional(), redirectStatus: z.literal(REDIRECT_STATUSES).optional() })
  .refine(data => data.url !== undefined || data.redirectStatus !== undefined, {
    message: 'at least one of url or redirectStatus is required',
  })

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
})

export type CreateLinkInput = z.infer<typeof createLinkSchema>
export type UpdateLinkInput = z.infer<typeof updateLinkSchema>
export type PaginationInput = z.infer<typeof paginationSchema>
