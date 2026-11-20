# syntax=docker/dockerfile:1

# Build the TanStack Start / Nitro application in a pinned Node major version.
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json ./
# The repository currently has no committed npm lockfile, so install from the
# declared package ranges. A lockfile should be committed before production use.
RUN npm install --no-audit --no-fund

COPY . .
ENV NODE_ENV=production
ENV NITRO_PRESET=node-server
RUN npm run build

# Run only the generated Nitro server output; source code and build tooling
# are not included in the runtime image.
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=build --chown=node:node /app/.output ./.output

USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
