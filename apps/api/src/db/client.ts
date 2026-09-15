import { SQL } from 'bun'
import env from '../env'

export const db = new SQL({
  adapter: 'mysql',
  allowPublicKeyRetrieval: env.MYSQL_ALLOW_PUBLIC_KEY_RETRIEVAL,
  url: env.DATABASE_URL,
  max: env.MAX_POOL_SIZE,
})
