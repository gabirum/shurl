import ky from 'ky'
import { API_URL } from './env'
import { getOidc } from './oidc'

export const api = ky.create({
  baseUrl: API_URL,
  headers: { 'X-Requested-With': 'ky' },
  hooks: {
    beforeRequest: [
      async ({ request }) => {
        const oidc = await getOidc()
        if (oidc.isUserLoggedIn) {
          const accessToken = await oidc.getAccessToken()
          request.headers.set('Authorization', `Bearer ${accessToken}`)
        }
      },
    ],
  },
})
