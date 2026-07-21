import type { AppType } from '@shurl/api'
import { hc } from 'hono/client'
import { API_URL } from './env'
import { getOidc } from './oidc'

export const api = hc<AppType>(API_URL, {
  headers: async () => {
    const oidc = await getOidc()
    const headers: Record<string, string> = {}
    if (oidc.isUserLoggedIn) headers.Authorization = `Bearer ${await oidc.getAccessToken()}`
    return headers
  },
})
