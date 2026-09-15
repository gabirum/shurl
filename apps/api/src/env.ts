import z from 'zod'

const envSchema = z.object({
  LOG_LEVEL: z.enum(['silent', 'fatal', 'error', 'warn', 'info', 'debug', 'trace']),
  JWKS_URI: z.url({ protocol: /^https?$/ }),
  JWK_ISSUER: z.url({ protocol: /^https?$/ }),
  AUDIENCE: z.string(),
  JWT_ROLE_CLAIM: z.string(),
  JWT_USERNAME_CLAIM: z.string().default('preferred_username'),
  DATABASE_URL: z.url({ protocol: /^mysql2?$/ }),
  MYSQL_ALLOW_PUBLIC_KEY_RETRIEVAL: z.boolean().default(false),
  MAX_POOL_SIZE: z.int().positive().default(10),
  REDIS_URL: z.url({ protocol: /^(redis|rediss|valkey)$/ }),
  CORS_ORIGIN: z
    .string()
    .transform(value => value.split(',').map(origin => origin.trim()))
    .pipe(z.array(z.url({ protocol: /^https?$/ }))),
  PUBLIC_BASE_URL: z.url({ protocol: /^https?$/ }).transform(value => value.replace(/\/+$/, '')),
})

const { data: env, error } = envSchema.safeParse(Bun.env)
if (error) {
  console.error('Invalid env')
  console.error(z.treeifyError(error))
  process.exit(1)
}

export default env!
