FROM oven/bun:1.4.0 AS base

WORKDIR /usr/src/shurl

ENV NODE_ENV=production

COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN bun install --frozen-lockfile --production
COPY apps/api/src apps/api/src

USER bun
WORKDIR /usr/src/shurl/apps/api
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
ENTRYPOINT [ "bun", "run", "src/index.ts" ]
