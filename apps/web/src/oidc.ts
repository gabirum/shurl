import { oidcSpa } from 'oidc-spa/react-spa'
import { z } from 'zod'
import { OIDC_CLIENT_ID, OIDC_ISSUER } from './env'
import i18n from './i18n'

export const { bootstrapOidc, useOidc, getOidc, enforceLogin, OidcInitializationGate, withLoginEnforced } = oidcSpa
  .withExpectedDecodedIdTokenShape({
    decodedIdTokenSchema: z.object({
      sub: z.string(),
      preferred_username: z.string(),
      // Client roles, keyed by client id — mirrors the JWT_ROLE_CLAIM path resolved server-side
      // in apps/api/src/auth.ts (`resource_access.shurl.roles`). Populated by the "shurl client
      // roles" protocol mapper on the `shurl` Keycloak client (see docker/keycloak/realm-export.json).
      resource_access: z.record(z.string(), z.object({ roles: z.array(z.string()).optional() })).optional(),
    }),
    decodedIdToken_mock: {
      sub: '0',
      preferred_username: 'teste',
      resource_access: { [OIDC_CLIENT_ID]: { roles: ['admin'] } },
    },
  })
  .createUtils()

bootstrapOidc(
  import.meta.env.VITE_OIDC_USE_MOCK === 'true'
    ? { implementation: 'mock', isUserInitiallyLoggedIn: true }
    : {
        implementation: 'real',
        clientId: OIDC_CLIENT_ID,
        issuerUri: OIDC_ISSUER,
        // Follow the app's selected language on the Keycloak login page. Omitted for silent
        // (iframe) sign-in, where UI query params like this one are meaningless.
        extraQueryParams: ({ isSilent }) => (isSilent ? {} : { ui_locales: i18n.language }),
      },
)
