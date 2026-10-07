import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { JwtVariables } from 'hono/jwt'
import { ADMIN_ROLE, hasRole } from '../auth'
import { errorSchema } from '../links/links.schema'
import type { DomainRow } from './domains.repository'
import { createDomainSchema, domainIdParamSchema, domainListSchema, domainSchema } from './domains.schema'
import * as domainsService from './domains.service'

type Env = { Variables: JwtVariables }

const tags = ['Domains']
const security = [{ Bearer: [] }]

function requireAdmin(c: Context<Env>): void {
  if (!hasRole(c.get('jwtPayload'), ADMIN_ROLE)) throw new HTTPException(403, { message: 'admin role required' })
}

function toDto(row: DomainRow) {
  return { id: Number(row.id), host: row.host, scheme: row.scheme, createdAt: row.created_at.toISOString() }
}

export const managedDomains = new OpenAPIHono<Env>()
  .openapi(
    createRoute({
      method: 'get',
      path: '/',
      tags,
      security,
      summary: 'List registered domains',
      responses: { 200: { content: { 'application/json': { schema: domainListSchema } }, description: 'domains' } },
    }),
    async c => c.json((await domainsService.list()).map(toDto), 200),
  )
  .openapi(
    createRoute({
      method: 'post',
      path: '/',
      tags,
      security,
      summary: 'Register a domain (admin only)',
      request: { body: { required: true, content: { 'application/json': { schema: createDomainSchema } } } },
      responses: {
        201: { content: { 'application/json': { schema: domainSchema } }, description: 'domain created' },
        409: { content: { 'application/json': { schema: errorSchema } }, description: 'domain already registered' },
      },
    }),
    async c => {
      requireAdmin(c)
      return c.json(toDto(await domainsService.create(c.req.valid('json'))), 201)
    },
  )
  .openapi(
    createRoute({
      method: 'delete',
      path: '/{id}',
      tags,
      security,
      summary: 'Remove a domain without links (admin only)',
      request: { params: domainIdParamSchema },
      responses: {
        204: { description: 'domain removed' },
        404: { content: { 'application/json': { schema: errorSchema } }, description: 'domain not found' },
        409: { content: { 'application/json': { schema: errorSchema } }, description: 'domain still has links' },
      },
    }),
    async c => {
      requireAdmin(c)
      await domainsService.remove(c.req.valid('param').id)
      return c.body(null, 204)
    },
  )
