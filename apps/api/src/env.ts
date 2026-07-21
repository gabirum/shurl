import z from 'zod'

const envSchema = z.object({
  LOG_LEVEL: z.enum(['silent', 'fatal', 'error', 'warn', 'info', 'debug', 'trace']),
  JWKS_URI: z.url({ protocol: /^https?$/ }),
  JWK_ISSUER: z.url({ protocol: /^https?$/ }),
  AUDIENCE: z.string(),
  JWT_ROLE_CLAIM: z.string(),
  DATABASE_URL: z.url({ protocol: /^mysql$/ }),
  REDIS_URL: z.url({ protocol: /^(redis|rediss|valkey)$/ }),
})

const { data: env, error } = envSchema.safeParse(Bun.env)
if (error) {
  console.error('Invalid env')
  console.error(z.treeifyError(error))
  process.exit(1)
}

export default env!
