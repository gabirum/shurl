import { prometheus } from '@hono/prometheus'
import { swaggerUI } from '@hono/swagger-ui'
import { OpenAPIHono } from '@hono/zod-openapi'
import { getConnInfo } from 'hono/bun'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { ipRestriction } from 'hono/ip-restriction'
import { jwk } from 'hono/jwk'
import type { JwtVariables } from 'hono/jwt'
import { poweredBy } from 'hono/powered-by'
import { prettyJSON } from 'hono/pretty-json'
import { requestId, RequestIdVariables } from 'hono/request-id'
import { secureHeaders } from 'hono/secure-headers'
import { migrate } from './db'
import env from './env'
import { managedLinks, publicLinks } from './links/links.routes'
import { logger } from './logger'
import { Exception } from './util'

process.on('uncaughtException', error => {
  logger.fatal({ err: error }, 'uncaught exception, terminating')
  process.exit(1)
})

process.on('unhandledRejection', reason => {
  logger.fatal({ err: reason }, 'unhandled promise rejection, terminating')
  process.exit(1)
})

const app = new OpenAPIHono<{ Variables: RequestIdVariables & JwtVariables }>()
const { printMetrics, registerMetrics } = prometheus({ collectDefaultMetrics: true })

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

app.get(
  '/metrics',
  ipRestriction(getConnInfo, {
    allowList: ['127.0.0.1', '::1', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/8', 'fc00::/7'],
  }),
  printMetrics,
)

app.route('/auth/links', managedLinks)
app.route('/c', publicLinks)

app.openAPIRegistry.registerComponent('securitySchemes', 'Bearer', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
})

app.doc('/openapi.json', {
  openapi: '3.1.0',
  info: { title: 'shurl', version: '1.0.0', description: 'URL shortener API' },
})
app.get('/docs', swaggerUI({ url: '/openapi.json' }))

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse()
  if (err instanceof Exception) return c.json({ code: err.code, message: err.message }, err.suggestedStatus)

  logger.error({ err, requestId: c.get('requestId') }, 'unhandled error')
  return c.json({ code: 'E_INTERNAL', message: 'internal server error' }, 500)
})

try {
  await migrate()
} catch (error) {
  logger.fatal({ err: error }, 'failed to apply database migrations, terminating')
  process.exit(1)
}

logger.info('shurl ready')

export default app
