import type { InferRequestType, InferResponseType } from 'hono/client'
import { api } from '@/api'

const listLinks = api.auth.links.$get
const createLink = api.auth.links.$post
const updateLink = api.auth.links[':code'].$patch
const removeLink = api.auth.links[':code'].$delete

export type Link = InferResponseType<typeof createLink, 201>
export type LinkPage = InferResponseType<typeof listLinks, 200>
export type CreateLinkInput = InferRequestType<typeof createLink>['json']
export type UpdateLinkInput = InferRequestType<typeof updateLink>['json']

export class LinkApiError extends Error {}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null
    throw new LinkApiError(body?.message ?? `request failed with status ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const linksApi = {
  list: (page: number, size: number) =>
    listLinks({ query: { page: String(page), size: String(size) } }).then(res => unwrap<LinkPage>(res)),
  create: (input: CreateLinkInput) => createLink({ json: input }).then(res => unwrap<Link>(res)),
  update: (code: string, patch: UpdateLinkInput) =>
    updateLink({ param: { code }, json: patch }).then(res => unwrap<Link>(res)),
  remove: (code: string) =>
    removeLink({ param: { code } }).then(res => {
      if (!res.ok) return unwrap(res)
    }),
}
