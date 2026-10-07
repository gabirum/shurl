import type { ClientResponse } from 'hono/client'
import type { SuccessStatusCode } from 'hono/utils/http-status'
import { useTranslation } from 'react-i18next'

export class LinkApiError extends Error {
  readonly code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}

export async function unwrap<
  T,
  C extends ClientResponse<T>,
  R = C extends ClientResponse<infer U, SuccessStatusCode> ? U : never,
>(res: C): Promise<R> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { code?: string; message?: string } | null
    throw new LinkApiError(body?.message ?? `request failed with status ${res.status}`, body?.code)
  }
  return res.json() as Promise<R>
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
