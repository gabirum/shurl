FROM oven/bun:1.3.14 AS builder

WORKDIR /builder

COPY package.json bun.lock ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
RUN bun install --frozen-lockfile
COPY apps/web apps/web
COPY apps/api/tsconfig*.json apps/api/
COPY apps/api/src apps/api/src
ENV VITE_OIDC_USE_MOCK=false
RUN bun run --filter '@shurl/web' build


FROM nginx:alpine AS runtime

# Remove nginx's stock welcome page/error page — otherwise unused leftovers
# under the shared document root now that the app lives under /shurl.
RUN rm -f /usr/share/nginx/html/index.html /usr/share/nginx/html/50x.html

COPY --from=builder /builder/apps/web/dist /usr/share/nginx/html/shurl
COPY apps/web/default.conf /etc/nginx/conf.d/default.conf

COPY apps/web/99-runtime-env.sh /docker-entrypoint.d/99-runtime-env.sh
RUN chmod +x /docker-entrypoint.d/99-runtime-env.sh
