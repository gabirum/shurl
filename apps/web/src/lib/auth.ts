import { OIDC_CLIENT_ID } from '@/env'
import { useOidc } from '@/oidc'

export const ADMIN_ROLE = 'admin'

/** Mirrors `hasRole`/`ADMIN_ROLE` in apps/api/src/auth.ts, read off the decoded ID token instead of a JWT payload. */
export function useIsAdmin(): boolean {
  const { decodedIdToken } = useOidc({ assert: 'user logged in' })
  return decodedIdToken.resource_access?.[OIDC_CLIENT_ID]?.roles?.includes(ADMIN_ROLE) ?? false
}
