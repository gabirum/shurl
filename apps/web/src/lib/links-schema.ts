// Mirrors apps/api/src/links/links.schema.ts — kept in sync by hand since these are runtime
// values (not just types), which can't cross the workspace boundary the way `AppType` does.
export const REDIRECT_STATUSES = [302, 307, 308] as const
export const PERMANENT_REDIRECT_STATUS = 308
export const CODE_PATTERN = /^[A-Za-z0-9_-]{1,32}$/

export type RedirectStatus = (typeof REDIRECT_STATUSES)[number]

export const REDIRECT_STATUS_LABELS: Record<RedirectStatus, string> = {
  302: '302 · Temporary (Found)',
  307: '307 · Temporary (method preserved)',
  308: '308 · Permanent (immutable)',
}
