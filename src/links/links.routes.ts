import { zValidator } from '@hono/zod-validator'
import { Hono, type Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { JwtVariables } from 'hono/jwt'
import type { LinkRow } from './links.repository'
import { codeSchema, createLinkSchema, paginationSchema, updateLinkSchema } from './links.schema'
import * as linksService from './links.service'

type Env = { Variables: JwtVariables }

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

export const managedLinks = new Hono<Env>()

managedLinks.post('/', zValidator('json', createLinkSchema), async c => {
  const owner = ownerOf(c)
  const input = c.req.valid('json')
  const link = await linksService.create(owner, input)
  return c.json(toDto(link), 201)
})

managedLinks.get('/', zValidator('query', paginationSchema), async c => {
  const owner = ownerOf(c)
  const pagination = c.req.valid('query')
  const slice = await linksService.list(owner, pagination)
  return c.json({ ...slice, data: slice.data.map(toDto) })
})

managedLinks.get('/:code', async c => {
  const owner = ownerOf(c)
  const link = await linksService.get(owner, c.req.param('code'))
  return c.json(toDto(link))
})

managedLinks.patch('/:code', zValidator('json', updateLinkSchema), async c => {
  const owner = ownerOf(c)
  const patch = c.req.valid('json')
  const link = await linksService.update(owner, c.req.param('code'), patch)
  return c.json(toDto(link))
})

managedLinks.delete('/:code', async c => {
  const owner = ownerOf(c)
  await linksService.remove(owner, c.req.param('code'))
  return c.body(null, 204)
})

export const publicLinks = new Hono()

publicLinks.get('/:code', async c => {
  const code = c.req.param('code')
  if (!codeSchema.safeParse(code).success) return c.notFound()

  const link = await linksService.resolve(code)
  if (!link) return c.notFound()

  return c.redirect(link.target_url, link.redirect_status)
})
