# Reproducible build check for the AEVOTRON Cloudflare/TanStack app.
# This image validates build output; it is deliberately not a production runtime.
FROM node:22-bookworm-slim AS app-build
WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm test && npm run lint && npm run build

FROM node:22-bookworm-slim AS build-verification
WORKDIR /app

COPY --from=app-build /app/dist/client ./dist/client
COPY --from=app-build /app/dist/server ./dist/server
COPY --from=app-build /app/.wrangler/deploy/config.json ./.wrangler/deploy/config.json
COPY docker-verify.sh ./docker-verify.sh

RUN chmod 0555 ./docker-verify.sh
ENTRYPOINT ["./docker-verify.sh"]
