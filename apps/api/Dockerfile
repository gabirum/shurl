FROM oven/bun AS base

WORKDIR /usr/src/shurl

ENV NODE_ENV=production

COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
RUN bun install --frozen-lockfile --production
COPY apps/api/src apps/api/src

USER bun
WORKDIR /usr/src/shurl/apps/api
EXPOSE 3000
ENTRYPOINT [ "bun", "run", "src/index.ts" ]
