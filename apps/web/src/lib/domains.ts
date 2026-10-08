import { api } from '@/api'
import type { InferRequestType, InferResponseType } from 'hono/client'
import { unwrap } from './api-utils'

const listDomains = api.auth.domains.$get
const createDomain = api.auth.domains.$post
const removeDomain = api.auth.domains[':id'].$delete

export type Domain = InferResponseType<typeof listDomains, 200>[number]
export type CreateDomainInput = InferRequestType<typeof createDomain>['json']

export const domainsApi = {
  list: () => listDomains().then(unwrap),
  create: (input: CreateDomainInput) => createDomain({ json: input }).then(unwrap),
  remove: (id: number) =>
    removeDomain({ param: { id: String(id) } }).then(res => {
      if (!res.ok) return unwrap(res)
    }),
}
