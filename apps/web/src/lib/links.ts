import type { InferRequestType, InferResponseType } from 'hono/client'
import { useTranslation } from 'react-i18next'
import { api } from '@/api'

const listLinks = api.auth.links.$get
const createLink = api.auth.links.$post
const updateLink = api.auth.links[':id'].$patch
const removeLink = api.auth.links[':id'].$delete

export type Link = InferResponseType<typeof createLink, 201>
export type LinkPage = InferResponseType<typeof listLinks, 200>
export type CreateLinkInput = InferRequestType<typeof createLink>['json']
export type UpdateLinkInput = InferRequestType<typeof updateLink>['json']

export class LinkApiError extends Error {
  readonly code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { code?: string; message?: string } | null
    throw new LinkApiError(body?.message ?? `request failed with status ${res.status}`, body?.code)
  }
  return res.json() as Promise<T>
}

export const linksApi = {
  list: (page: number, size: number) =>
    listLinks({ query: { page: String(page), size: String(size) } }).then(res => unwrap<LinkPage>(res)),
  create: (input: CreateLinkInput) => createLink({ json: input }).then(res => unwrap<Link>(res)),
  update: (id: number, patch: UpdateLinkInput) =>
    updateLink({ param: { id: String(id) }, json: patch }).then(res => unwrap<Link>(res)),
  remove: (id: number) =>
    removeLink({ param: { id: String(id) } }).then(res => {
      if (!res.ok) return unwrap(res)
    }),
}

// Mirrors the stable error codes apps/api raises (see apps/api/src/util.ts's Exception
// subclasses) — anything else falls back to the server-supplied message so a new backend
// error code never breaks the UI, it just shows up untranslated.
const KNOWN_ERROR_CODES = [
  'E_NOT_FOUND',
  'E_CODE_CONFLICT',
  'E_LINK_IMMUTABLE',
  'E_CODE_GENERATION',
  'E_DOMAIN_NOT_FOUND',
  'E_DOMAIN_CONFLICT',
  'E_DOMAIN_IN_USE',
  'E_INTERNAL',
] as const

/** Resolves a translated message for an error thrown by `linksApi`, falling back to the server's own message. */
export function useApiErrorMessage() {
  const { t } = useTranslation()
  return (err: unknown): string => {
    if (err instanceof LinkApiError) {
      const code = KNOWN_ERROR_CODES.find(c => c === err.code)
      if (code) return t(`errors.${code}`)
      return err.message || t('errors.unknown')
    }
    return t('errors.unknown')
  }
}
