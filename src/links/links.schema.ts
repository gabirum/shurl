import { z } from '@hono/zod-openapi'

export const REDIRECT_STATUSES = [302, 307, 308] as const
export const PERMANENT_REDIRECT_STATUS = 308

export const codeSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,32}$/, 'code must match [A-Za-z0-9_-]{1,32}')
  .openapi({ example: 'aZ3-1x9', description: 'short code identifying the link' })

export const codeParamSchema = z.object({ code: codeSchema })

// `.openapi({ enum })` works around @asteasolutions/zod-to-openapi only emitting the first
// value of a multi-value z.literal() (it otherwise renders `enum: [302]` instead of all three).
const redirectStatusSchema = z.literal(REDIRECT_STATUSES).openapi({ enum: REDIRECT_STATUSES as unknown as number[] })

export const createLinkSchema = z
  .object({
    url: z.url().openapi({ example: 'https://example.com/some/very/long/path' }),
    redirectStatus: redirectStatusSchema.openapi({
      example: 302,
      description: '302/307 are temporary, 308 makes the link permanently immutable',
    }),
    code: codeSchema.optional().openapi({ description: 'custom alias; a random code is generated if omitted' }),
  })
  .openapi('CreateLinkInput')

export const updateLinkSchema = z
  .object({
    url: z.url().optional().openapi({ example: 'https://example.com/new-target' }),
    redirectStatus: redirectStatusSchema.optional().openapi({ example: 307 }),
  })
  .refine(data => data.url !== undefined || data.redirectStatus !== undefined, {
    message: 'at least one of url or redirectStatus is required',
  })
  .openapi('UpdateLinkInput')

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
  size: z.coerce.number().int().min(1).max(100).default(20).openapi({ example: 20 }),
})

export const linkSchema = z
  .object({
    code: codeSchema,
    url: z.url().openapi({ example: 'https://example.com/some/very/long/path' }),
    redirectStatus: redirectStatusSchema.openapi({ example: 302 }),
    owner: z.string().openapi({ example: 'a1b2c3d4-...', description: 'JWT sub of the link owner' }),
    accessCount: z.number().int().openapi({ example: 42 }),
    createdAt: z.string().openapi({ example: '2026-01-01T00:00:00.000Z' }),
    updatedAt: z.string().openapi({ example: '2026-01-01T00:00:00.000Z' }),
  })
  .openapi('Link')

export const linkPageSchema = z
  .object({
    data: z.array(linkSchema),
    isFirst: z.boolean(),
    isLast: z.boolean(),
    hasNext: z.boolean(),
    hasPrevious: z.boolean(),
    totalPages: z.number().int(),
    totalElements: z.number().int(),
  })
  .openapi('LinkPage')

export const errorSchema = z
  .object({
    code: z.string().openapi({ example: 'E_NOT_FOUND' }),
    message: z.string().openapi({ example: 'link not found' }),
  })
  .openapi('Error')

export type CreateLinkInput = z.infer<typeof createLinkSchema>
export type UpdateLinkInput = z.infer<typeof updateLinkSchema>
export type PaginationInput = z.infer<typeof paginationSchema>
