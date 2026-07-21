interface RuntimeEnv {
  API_URL: string
  OIDC_ISSUER: string
  OIDC_CLIENT_ID: string
}

declare global {
  interface Window {
    RUNTIME_ENV: Readonly<RuntimeEnv>
  }
}

const getEnv = (k: keyof RuntimeEnv): string =>
  window.RUNTIME_ENV[k] === `$\{${k}}` ? import.meta.env[`VITE_${k}`] : window.RUNTIME_ENV[k]

export const API_URL = getEnv('API_URL')
export const OIDC_ISSUER = getEnv('OIDC_ISSUER')
export const OIDC_CLIENT_ID = getEnv('OIDC_CLIENT_ID')
