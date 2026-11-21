# Docker preview

This is a parallel, local Docker runtime for the AEVOTRON web application. It
does not replace or modify the Vercel deployment.

The Vite/Nitro build emits a runnable `.output/server/index.mjs` plus public
assets in `.output/public`. The Docker image runs that Nitro server; it does
not serve only the client folder with Nginx, which would break SSR and server
routes.

## Local preview

Requirements: Docker Engine and the Docker Compose plugin.

Copy the example configuration and fill in the three public Base44 application
settings from the connected Base44 app:

```sh
cp .env.docker.example .env
```

Then build and start the container:

```sh
docker compose up --build -d
```

Open http://localhost:3000. To stop it:

```sh
docker compose down
```

The `VITE_BASE44_*` values are build-time configuration because Vite embeds
them into the browser bundle. Rebuild the image after changing `.env`.
These values identify/configure the Base44 app; do not put provider API keys,
master encryption keys, or other secrets in this file. The generated browser
bundle is public.

To build and run the HTTP smoke test manually:

```sh
docker compose build
sh docker-verify.sh
```

The Docker build runs `npm install --no-audit --no-fund`, `npm test`,
`npm run lint` and `npm run build`. The runtime image contains only Nitro's
generated `.output` directory and runs as the unprivileged `node` user.

This repository currently has no committed npm lockfile, so the dependency
install follows the existing CI's `npm install` strategy rather than
`npm ci`.

## Base44 runtime boundary

The Docker image currently runs the AEVOTRON web application, not a complete
self-hosted replacement for Base44.

The repository's server middleware calls `createClientFromRequest(request)`
and expects Base44 platform-injected request headers. Base44 authentication,
entity storage, and the Deno functions under `base44/functions/` remain
platform-managed; those Deno functions are not built into or started by this
Node container. As a result, a successful Docker page/asset smoke test does
not prove that sign-in, MFA, workspaces, API-key management, provider
connections, usage reporting, or the API gateway work in a standalone
environment.

The API-key, provider-connection, and gateway functions also require
`AEVOTRON_MASTER_KEY` to be configured as a Base44 function secret. It must
be a Base64-encoded 32-byte key. Keep it in the platform's secret manager; do
not put it in `.env`, Docker build arguments, the image, or Git.

A truly independent Docker deployment will require replacing the Base44
request/auth integration, entity storage, and Deno functions with a
self-hosted backend and database, then adding integration tests for those
flows. That migration is separate from this safe parallel web-container
preview.

## GitHub Actions

The `Docker build verification` workflow builds the image and runs
`docker-verify.sh` through the POSIX shell. The script starts the container,
checks that the homepage returns HTML, fetches every same-origin JS/CSS asset
referenced by the homepage, and verifies that the declared login, registration,
password recovery, MFA, and dashboard routes return HTML over HTTP. It does
not push an image to a registry or deploy it. These are HTTP smoke tests, not
browser-level authentication or API integration tests.

## Production boundary

Vercel remains the production serving platform. This branch does not change
production domains, DNS, aliases, environment variables, or deployment
settings. A separate reviewed change is required before any production
migration.
