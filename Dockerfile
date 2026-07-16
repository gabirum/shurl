FROM oven/bun AS base

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY src .

USER bun
EXPOSE 3000
ENTRYPOINT [ "bun", "run", "index.ts" ]