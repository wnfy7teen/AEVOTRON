# Build AEVOTRON with the same Node/Nitro toolchain used by the repository CI.
FROM node:22-bookworm-slim AS dependencies
WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund

FROM dependencies AS build
COPY . .
RUN npm test && npm run lint && npm run build

# Nitro selected the node-server preset for this project. Run its generated
# server bundle instead of serving the client directory as a static site.
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    NITRO_HOST=0.0.0.0 \
    NITRO_PORT=3000 \
    HOST=0.0.0.0 \
    PORT=3000

COPY --from=build --chown=node:node /app/.output ./.output

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", ".output/server/index.mjs"]
