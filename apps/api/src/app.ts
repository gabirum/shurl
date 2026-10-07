import { prometheus } from '@hono/prometheus'
import { OpenAPIHono } from '@hono/zod-openapi'
import { getConnInfo } from 'hono/bun'
import { HTTPException } from 'hono/http-exception'
import { ipRestriction } from 'hono/ip-restriction'
import type { JwtVariables } from 'hono/jwt'
import { requestId, RequestIdVariables } from 'hono/request-id'
import { secureHeaders } from 'hono/secure-headers'
import { logger } from './logger'
import { Exception } from './util'

export type AppEnv = { Variables: RequestIdVariables & JwtVariables }

const { printMetrics, registerMetrics } = prometheus({ collectDefaultMetrics: true })

/** Middleware and error handling shared by every host-specific app (see index.ts's dispatch). */
export function createBaseApp() {
  const app = new OpenAPIHono<AppEnv>()

  app.use(requestId())
  app.use(async (c, next) => {
    const start = performance.now()
    await next()
    const end = performance.now()

    const fields = {
      requestId: c.get('requestId'),
      host: c.req.header('host'),
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: Math.round(end - start),
    }
    if (c.res.status >= 500) logger.error(fields, 'request completed')
    else if (c.res.status >= 400) logger.warn(fields, 'request completed')
    else logger.info(fields, 'request completed')
  })
  app.use(secureHeaders())
  app.use(registerMetrics)

  app.onError((err, c) => {
    if (err instanceof HTTPException) return err.getResponse()
    if (err instanceof Exception) return c.json({ code: err.code, message: err.message }, err.suggestedStatus)

    logger.error({ err, requestId: c.get('requestId') }, 'unhandled error')
    return c.json({ code: 'E_INTERNAL', message: 'internal server error' }, 500)
  })

  return app
}

/** Probe/scrape endpoints. Served on the admin host and on any host that isn't a registered domain. */
export function addOpsRoutes(app: ReturnType<typeof createBaseApp>) {
  app.get('/health', c => c.text('ok'))
  // ipRestriction allowlists the TCP connection's source IP, not X-Forwarded-For — behind a
  // proxy that connects from a private IP it passes everything, so keep /metrics off the
  // public ingress.
  app.get(
    '/metrics',
    ipRestriction(getConnInfo, {
      allowList: ['127.0.0.1', '::1', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', 'fc00::/7'],
    }),
    printMetrics,
  )
  return app
}
