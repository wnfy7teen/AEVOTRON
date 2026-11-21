# Cloudflare Workers preview

This project keeps the existing Nitro adapter for Vercel and the Docker-based
self-hosted stack while validating Cloudflare Workers on an isolated Vite
configuration.

## Local validation

```sh
npm install --no-audit --no-fund
npm run build:cloudflare
npm run preview:cloudflare
```

The Cloudflare preview runs in the Workers runtime. Do not use the Node/Nitro
preview as proof that the Workers build is compatible.

## Cloudflare configuration

- Worker name: `aevotron`
- Entry point: `@tanstack/react-start/server-entry`
- Vite config: `vite.config.cloudflare.js`
- Build command: `npm run build:cloudflare`
- Preview command: `npm run preview:cloudflare`
- Deploy command (manual, only after approval): `npm run deploy:cloudflare`

Connect the GitHub repository to Cloudflare Workers Builds and configure the
preview branch as `infra/cloudflare-workers-preview`. Do not enable automatic
production deployment from `main` during this validation phase.

## Runtime configuration

Configure these as Worker environment variables or secrets in the Cloudflare
dashboard. Never commit their values:

- `API_INTERNAL_URL` — HTTPS origin of the separately hosted AEVOTRON API.
- `AEVOTRON_API_URL` — legacy API-origin fallback used by route handlers.
- `AEVOTRON_GATEWAY_URL` — internal OpenAI-compatible gateway base URL.
- `AEVOTRON_INTERNAL_API_KEY` — internal gateway credential, if the AI server
  adapter is enabled.

The self-hosted API is a separate Node.js/PostgreSQL service and is not moved
to Workers by this frontend migration. The API VPS is not yet deployed; until
it is reachable, account, provider, key, and usage operations that depend on
it will return an unavailable/not-configured response. Do not expose internal
gateway credentials as `VITE_*` variables.

## Rollback boundary

The default `vite.config.js`, Nitro dependency, Vercel build script, Dockerfile,
and Docker Compose setup remain unchanged. Cloudflare preview work must not
change DNS, Vercel Production, or the existing production environment.
