import { z } from '@hono/zod-openapi'
import env from '../env'

export const hostSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/, 'host must be hostname[:port]')
  .max(255)
  .refine(host => host !== env.ADMIN_HOST, { message: 'host is reserved for the administrative application' })
  .openapi({ example: 'sh.example.com' })

export const createDomainSchema = z
  .object({ host: hostSchema, scheme: z.enum(['http', 'https']).default('https').openapi({ example: 'https' }) })
  .openapi('CreateDomainInput')

export const domainIdParamSchema = z.object({ id: z.coerce.number().int().positive().openapi({ example: 1 }) })

export const domainSchema = z
  .object({
    id: z.number().int().openapi({ example: 1 }),
    host: z.string().openapi({ example: 'sh.example.com' }),
    scheme: z.enum(['http', 'https']),
    createdAt: z.string().openapi({ example: '2026-01-01T00:00:00.000Z' }),
  })
  .openapi('Domain')

export const domainListSchema = z.array(domainSchema).openapi('DomainList')

export type CreateDomainInput = z.infer<typeof createDomainSchema>
