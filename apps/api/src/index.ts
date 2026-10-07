import { swaggerUI } from '@hono/swagger-ui'
import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import { jwk } from 'hono/jwk'
import { prettyJSON } from 'hono/pretty-json'
import { addOpsRoutes, createBaseApp, type AppEnv } from './app'
import { migrate } from './db'
import { findDomainByHost, loadDomains } from './domains/domains.registry'
import { managedDomains } from './domains/domains.routes'
import env from './env'
import { flushNow } from './links/links.counter'
import { managedLinks, publicLinks } from './links/links.routes'
import { logger } from './logger'

process.on('uncaughtException', error => {
  logger.fatal({ err: error }, 'uncaught exception, terminating')
  process.exit(1)
})

// Deliberately not fail-fast here: an unhandled rejection is usually a single
// missed `.catch` on a best-effort call (e.g. cache write), not a corrupted
// process state — logging and continuing avoids taking the instance down
// under normal traffic. Genuinely fatal errors still surface as uncaughtException.
process.on('unhandledRejection', reason => {
  logger.error({ err: reason }, 'unhandled promise rejection')
})

let shuttingDown = false
async function shutdown(signal: string) {
  if (shuttingDown) return
  shuttingDown = true
  logger.info({ signal }, 'shutting down, flushing pending access counts')
  await flushNow()
  process.exit(0)
}
process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))

// Requests are dispatched by Host (see `fetch` below) to one of three apps, so no route can
// shadow another and no short-code slugs need to be reserved:
//   ADMIN_HOST        -> adminApp: /shurl/api/* (management API + docs), /health, /metrics
//   registered domain -> redirectApp: GET /{code} only
//   any other host    -> opsApp: /health, /metrics only (e.g. probes hitting the pod IP)
const adminApi = new OpenAPIHono<AppEnv>()
adminApi.use(
  '/auth/*',
  jwk({ alg: ['RS256'], jwks_uri: env.JWKS_URI, verification: { aud: env.AUDIENCE, iss: env.JWK_ISSUER } }),
)
const adminRoutes = adminApi.route('/auth/links', managedLinks).route('/auth/domains', managedDomains)

const adminApp = addOpsRoutes(createBaseApp())
adminApp.use(cors({ origin: env.CORS_ORIGIN }))
adminApp.use(prettyJSON())
adminApp.route('/shurl/api', adminRoutes)

adminApp.openAPIRegistry.registerComponent('securitySchemes', 'Bearer', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
})
adminApp.doc('/shurl/api/openapi.json', {
  openapi: '3.1.0',
  info: { title: 'shurl', version: '1.0.0', description: 'URL shortener API' },
})
adminApp.get('/shurl/api/docs', swaggerUI({ url: '/shurl/api/openapi.json' }))

const redirectApp = createBaseApp()
redirectApp.route('/', publicLinks)

const opsApp = addOpsRoutes(createBaseApp())

try {
  await migrate()
} catch (error) {
  logger.fatal({ err: error }, 'failed to apply database migrations, terminating')
  process.exit(1)
}

await loadDomains()

logger.info('shurl ready')

// The RPC client type intentionally reflects the unprefixed adminRoutes shape (e.g.
// `api.auth.links`) — the /shurl/api prefix lives in the client's base URL instead, so the
// server owns the prefix without leaking it into every call site.
export type AppType = typeof adminRoutes

export default {
  fetch(req: Request, server: unknown) {
    const host = new URL(req.url).host.toLowerCase()
    if (host === env.ADMIN_HOST) return adminApp.fetch(req, server)
    if (findDomainByHost(host)) return redirectApp.fetch(req, server)
    return opsApp.fetch(req, server)
  },
}
