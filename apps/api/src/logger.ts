import pino from 'pino'
import env from './env'

export const logger = pino({
  level: env.LOG_LEVEL,
  // pino transports run in a worker thread, which is torn down with each `--isolate` test file and surfaces as an unhandled error
  transport: ['production', 'test'].includes(Bun.env.NODE_ENV ?? '') ? undefined : { target: 'pino-pretty' },
})
