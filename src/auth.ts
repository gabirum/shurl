import env from './env'

export const ADMIN_ROLE = 'admin'

const claimPath = env.JWT_ROLE_CLAIM.split('.')

function resolveClaim(payload: unknown): unknown {
  let current: unknown = payload
  for (const segment of claimPath) {
    if (typeof current !== 'object' || current === null) return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

/** Reads the roles claim (configured via `JWT_ROLE_CLAIM`) off a verified JWT payload. */
export function getRoles(payload: unknown): string[] {
  const claim = resolveClaim(payload)
  if (Array.isArray(claim)) return claim.filter((role): role is string => typeof role === 'string')
  if (typeof claim === 'string') return [claim]
  return []
}

export function hasRole(payload: unknown, role: string): boolean {
  return getRoles(payload).includes(role)
}
