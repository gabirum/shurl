import { api } from '@/api'
import type { InferRequestType, InferResponseType } from 'hono/client'
import { unwrap } from './api-utils'

const listLinks = api.auth.links.$get
const createLink = api.auth.links.$post
const updateLink = api.auth.links[':id'].$patch
const removeLink = api.auth.links[':id'].$delete

export type Link = InferResponseType<typeof createLink, 201>
export type LinkPage = InferResponseType<typeof listLinks, 200>
export type CreateLinkInput = InferRequestType<typeof createLink>['json']
export type UpdateLinkInput = InferRequestType<typeof updateLink>['json']

export const linksApi = {
  list: (page: number, size: number) =>
    listLinks({ query: { page: String(page), size: String(size) } }).then(res => unwrap(res)),
  create: (input: CreateLinkInput) => createLink({ json: input }).then(res => unwrap(res)),
  update: (id: number, patch: UpdateLinkInput) =>
    updateLink({ param: { id: String(id) }, json: patch }).then(res => unwrap(res)),
  remove: (id: number) =>
    removeLink({ param: { id: String(id) } }).then(res => {
      if (!res.ok) return unwrap(res)
    }),
}
