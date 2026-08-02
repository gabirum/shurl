import env from './env'

export const ADMIN_ROLE = 'admin'

const roleClaimPath = env.JWT_ROLE_CLAIM.split('.')
const usernameClaimPath = env.JWT_USERNAME_CLAIM.split('.')

function resolveClaim(payload: unknown, claimPath: string[]): unknown {
  let current: unknown = payload
  for (const segment of claimPath) {
    if (typeof current !== 'object' || current === null) return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

/** Reads the roles claim (configured via `JWT_ROLE_CLAIM`) off a verified JWT payload. */
export function getRoles(payload: unknown): string[] {
  const claim = resolveClaim(payload, roleClaimPath)
  if (Array.isArray(claim)) return claim.filter((role): role is string => typeof role === 'string')
  if (typeof claim === 'string') return [claim]
  return []
}

export function hasRole(payload: unknown, role: string): boolean {
  return getRoles(payload).includes(role)
}

/** Reads the username claim (configured via `JWT_USERNAME_CLAIM`, e.g. `preferred_username`) off a verified JWT payload. */
export function getUsername(payload: unknown): string | undefined {
  const claim = resolveClaim(payload, usernameClaimPath)
  return typeof claim === 'string' && claim.length > 0 ? claim : undefined
}
