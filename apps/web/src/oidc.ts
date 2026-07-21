import { oidcSpa } from 'oidc-spa/react-spa'
import { z } from 'zod'
import { OIDC_CLIENT_ID, OIDC_ISSUER } from './env'

export const { bootstrapOidc, useOidc, getOidc, enforceLogin, OidcInitializationGate, withLoginEnforced } = oidcSpa
  .withExpectedDecodedIdTokenShape({
    decodedIdTokenSchema: z.object({ sub: z.string(), preferred_username: z.string() }),
    decodedIdToken_mock: { sub: '0', preferred_username: 'teste' },
  })
  .createUtils()

bootstrapOidc(
  import.meta.env.VITE_OIDC_USE_MOCK === 'true'
    ? { implementation: 'mock', isUserInitiallyLoggedIn: true }
    : { implementation: 'real', clientId: OIDC_CLIENT_ID, issuerUri: OIDC_ISSUER },
)
