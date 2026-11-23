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


## Temporary Groq-only preview (no API VPS)

The preview branch includes a deliberately limited, server-side Groq path for
testing live models without deploying the full Node.js/PostgreSQL backend.
It does not replace the self-hosted API or provide persistent accounts,
provider connections, chat history, API keys, or usage records. Demo workspace
conversations remain in browser memory.

Before enabling this path:

1. In Workers & Pages, select the `aevotron` Worker and enable Cloudflare
   Access for **Preview URLs only**. Restrict the Access policy to your own
   email address. Do not enable Access for production traffic.
2. In the Worker's preview environment, add the following values under
   Settings > Variables and Secrets:
   - Secret `GROQ_API_KEY`: a newly created Groq key. Never commit it or put
     it in a `VITE_*` variable.
   - Variable `CF_ACCESS_TEAM_DOMAIN`: your Cloudflare Access team domain,
     for example `your-team.cloudflareaccess.com` (without a path).
   - Variable `CF_ACCESS_AUD`: the AUD tag of the Access application that
     protects this Worker preview.
3. Deploy the preview Worker after setting these values.

The Groq endpoints validate the Cloudflare Access JWT signature, issuer,
audience, and expiry before using the server-side key. They only expose model
listing and streamed chat completions; the requested model must be a Groq model.
If Access or any required setting is missing, requests fail closed.

This is a temporary single-user testing path, not a public multi-tenant API.
Keep the Access policy restricted to trusted users and configure usage limits
or spending controls in Groq. Revoke any Groq key that has previously been
shared in chat or committed to a repository.

## Rollback boundary

The default `vite.config.js`, Nitro dependency, Vercel build script, Dockerfile,
and Docker Compose setup remain unchanged. Cloudflare preview work must not
change DNS, Vercel Production, or the existing production environment.
