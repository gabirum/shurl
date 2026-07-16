import { prometheus } from '@hono/prometheus'
import { Hono } from 'hono'
import { bearerAuth } from 'hono/bearer-auth'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { jwk } from 'hono/jwk'
import type { JwtVariables } from 'hono/jwt'
import { poweredBy } from 'hono/powered-by'
import { prettyJSON } from 'hono/pretty-json'
import { requestId, RequestIdVariables } from 'hono/request-id'
import { secureHeaders } from 'hono/secure-headers'
import { migrate } from './db'
import env from './env'
import { CodeConflictError } from './links/links.repository'
import { managedLinks, publicLinks } from './links/links.routes'
import { LinkImmutableError, LinkNotFoundError } from './links/links.service'
import { logger } from './logger'

process.on('uncaughtException', error => {
  logger.fatal({ err: error }, 'uncaught exception, terminating')
  process.exit(1)
})

process.on('unhandledRejection', reason => {
  logger.fatal({ err: reason }, 'unhandled promise rejection, terminating')
  process.exit(1)
})

const app = new Hono<{ Variables: RequestIdVariables & JwtVariables }>()
const { printMetrics, registerMetrics } = prometheus()

app.use(requestId())
app.use(async (c, next) => {
  const start = performance.now()
  await next()
  const fields = {
    requestId: c.get('requestId'),
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    durationMs: Math.round(performance.now() - start),
  }
  if (c.res.status >= 500) logger.error(fields, 'request completed')
  else if (c.res.status >= 400) logger.warn(fields, 'request completed')
  else logger.info(fields, 'request completed')
})
app.use(cors())
app.use(poweredBy())
app.use(secureHeaders())
app.use(prettyJSON())
app.use(registerMetrics)

app.use(
  '/auth/*',
  jwk({ alg: ['RS256'], jwks_uri: env.JWKS_URI, verification: { aud: env.AUDIENCE, iss: env.JWK_ISSUER } }),
)

app.get('/metrics', bearerAuth({ token: env.METRICS_TOKEN }), printMetrics)

app.route('/auth/links', managedLinks)
app.route('/c', publicLinks)

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse()
  if (err instanceof LinkNotFoundError) return c.json({ message: 'link not found' }, 404)
  if (err instanceof LinkImmutableError) return c.json({ message: 'permanent links cannot be modified' }, 409)
  if (err instanceof CodeConflictError) return c.json({ message: 'code already in use' }, 409)

  logger.error({ err, requestId: c.get('requestId') }, 'unhandled error')
  return c.json({ message: 'internal server error' }, 500)
})

try {
  await migrate()
} catch (error) {
  logger.fatal({ err: error }, 'failed to apply database migrations, terminating')
  process.exit(1)
}

logger.info('shurl ready')

export default app
