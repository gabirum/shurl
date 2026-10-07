import type { InferRequestType, InferResponseType } from 'hono/client'
import { api } from '@/api'
import { LinkApiError } from '@/lib/links'

const listDomains = api.auth.domains.$get
const createDomain = api.auth.domains.$post
const removeDomain = api.auth.domains[':id'].$delete

export type Domain = InferResponseType<typeof listDomains, 200>[number]
export type CreateDomainInput = InferRequestType<typeof createDomain>['json']

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { code?: string; message?: string } | null
    throw new LinkApiError(body?.message ?? `request failed with status ${res.status}`, body?.code)
  }
  return res.json() as Promise<T>
}

export const domainsApi = {
  list: () => listDomains().then(res => unwrap<Domain[]>(res)),
  create: (input: CreateDomainInput) => createDomain({ json: input }).then(res => unwrap<Domain>(res)),
  remove: (id: number) =>
    removeDomain({ param: { id: String(id) } }).then(res => {
      if (!res.ok) return unwrap(res)
    }),
}
