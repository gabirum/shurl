import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { JwtVariables } from 'hono/jwt'
import type { LinkRow } from './links.repository'
import {
  codeParamSchema,
  codeSchema,
  createLinkSchema,
  errorSchema,
  linkPageSchema,
  linkSchema,
  paginationSchema,
  updateLinkSchema,
} from './links.schema'
import * as linksService from './links.service'

type Env = { Variables: JwtVariables }

const tags = ['Links']
const security = [{ Bearer: [] }]

function ownerOf(c: Context<Env>): string {
  const payload = c.get('jwtPayload') as { sub?: unknown }
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new HTTPException(401, { message: 'token is missing a sub claim' })
  }
  return payload.sub
}

function toDto(link: LinkRow) {
  return {
    code: link.code,
    url: link.target_url,
    redirectStatus: link.redirect_status,
    accessCount: Number(link.access_count),
    createdAt: link.created_at.toISOString(),
    updatedAt: link.updated_at.toISOString(),
  }
}

export const managedLinks = new OpenAPIHono<Env>()

managedLinks.openapi(
  createRoute({
    method: 'post',
    path: '/',
    tags,
    security,
    summary: 'Create a link',
    request: { body: { required: true, content: { 'application/json': { schema: createLinkSchema } } } },
    responses: {
      201: { content: { 'application/json': { schema: linkSchema } }, description: 'link created' },
      409: { content: { 'application/json': { schema: errorSchema } }, description: 'code already in use' },
    },
  }),
  async c => {
    const owner = ownerOf(c)
    const input = c.req.valid('json')
    const link = await linksService.create(owner, input)
    return c.json(toDto(link), 201)
  },
)

managedLinks.openapi(
  createRoute({
    method: 'get',
    path: '/',
    tags,
    security,
    summary: 'List the caller’s links',
    request: { query: paginationSchema },
    responses: {
      200: { content: { 'application/json': { schema: linkPageSchema } }, description: 'paginated list of links' },
    },
  }),
  async c => {
    const owner = ownerOf(c)
    const pagination = c.req.valid('query')
    const slice = await linksService.list(owner, pagination)
    return c.json({ ...slice, data: slice.data.map(toDto) })
  },
)

managedLinks.openapi(
  createRoute({
    method: 'get',
    path: '/{code}',
    tags,
    security,
    summary: 'Get a link by code',
    request: { params: codeParamSchema },
    responses: {
      200: { content: { 'application/json': { schema: linkSchema } }, description: 'the link' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'link not found' },
    },
  }),
  async c => {
    const owner = ownerOf(c)
    const { code } = c.req.valid('param')
    const link = await linksService.get(owner, code)
    return c.json(toDto(link), 200)
  },
)

managedLinks.openapi(
  createRoute({
    method: 'patch',
    path: '/{code}',
    tags,
    security,
    summary: 'Update a link',
    request: {
      params: codeParamSchema,
      body: { required: true, content: { 'application/json': { schema: updateLinkSchema } } },
    },
    responses: {
      200: { content: { 'application/json': { schema: linkSchema } }, description: 'link updated' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'link not found' },
      409: {
        content: { 'application/json': { schema: errorSchema } },
        description: 'permanent links cannot be modified',
      },
    },
  }),
  async c => {
    const owner = ownerOf(c)
    const { code } = c.req.valid('param')
    const patch = c.req.valid('json')
    const link = await linksService.update(owner, code, patch)
    return c.json(toDto(link), 200)
  },
)

managedLinks.openapi(
  createRoute({
    method: 'delete',
    path: '/{code}',
    tags,
    security,
    summary: 'Delete a link',
    request: { params: codeParamSchema },
    responses: {
      204: { description: 'link removed' },
      404: { content: { 'application/json': { schema: errorSchema } }, description: 'link not found' },
      409: {
        content: { 'application/json': { schema: errorSchema } },
        description: 'permanent links cannot be modified',
      },
    },
  }),
  async c => {
    const owner = ownerOf(c)
    const { code } = c.req.valid('param')
    await linksService.remove(owner, code)
    return c.body(null, 204)
  },
)

export const publicLinks = new OpenAPIHono()

publicLinks.openapi(
  createRoute({
    method: 'get',
    path: '/{code}',
    tags: ['Redirect'],
    summary: 'Resolve a short code and redirect to its target URL',
    request: { params: codeParamSchema },
    responses: {
      302: { description: 'redirect to the target URL (status is 302, 307 or 308 depending on the link config)' },
      404: { description: 'link not found' },
    },
  }),
  async c => {
    const { code } = c.req.valid('param')
    if (!codeSchema.safeParse(code).success) return c.notFound()

    const link = await linksService.resolve(code)
    if (!link) return c.notFound()

    return c.redirect(link.target_url, link.redirect_status)
  },
)
