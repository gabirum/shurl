import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { oidcSpa } from 'oidc-spa/vite-plugin'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // nginx (see apps/web/default.conf) serves the built app under /shurl — only apply that
  // prefix for production builds, so `bun run dev` keeps serving from the domain root.
  base: command === 'build' ? '/shurl/' : '/',
  plugins: [
    tailwindcss(),
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    oidcSpa(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
}))
