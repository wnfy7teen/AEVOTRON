# AEVOTRON self-hosted API deployment runbook

This runbook deploys only PostgreSQL and the standalone API on a dedicated VPS. The web frontend remains on Vercel. It does not use or modify the Donation Alerts VPS.

## Target topology

- Vercel hosts the AEVOTRON frontend.
- A dedicated VPS runs PostgreSQL 17, the Node.js API, and a loopback-only Nginx API edge.
- The VPS host Nginx terminates HTTPS for a dedicated API hostname and proxies to `127.0.0.1:3001`.
- Vercel's server-side `API_INTERNAL_URL` points to the HTTPS API origin. The browser continues to call the same-origin Vercel `/api/v1/*` proxy.
- PostgreSQL is not published to the host or internet.

## VPS requirements

Recommended target for the planned deployment: Ubuntu 24.04, 4 vCPU, 8 GB RAM, and 80–120 GB SSD. Keep the existing Donation Alerts VPS untouched.

Install Docker Engine and the Docker Compose plugin using Docker's official Ubuntu instructions. Configure the host firewall to allow only SSH (22), HTTP (80), and HTTPS (443). Do not open PostgreSQL (5432), API (3001), or the internal app ports publicly.

## Configure secrets

On the new VPS, clone the repository and check out `feat/self-hosted-backend`. Create a private `.env` in the repository root; never commit it.

Generate values locally on the VPS:

```sh
openssl rand -hex 24       # POSTGRES_PASSWORD
openssl rand -base64 32    # AEVOTRON_MASTER_KEY; exactly 32 decoded bytes
openssl rand -hex 32       # IP_HASH_SALT
```

Set these values in `.env`:

```dotenv
POSTGRES_PASSWORD=<generated-hex-password>
AEVOTRON_MASTER_KEY=<generated-base64-key>
IP_HASH_SALT=<generated-hex-salt>
PUBLIC_APP_URL=https://<the-exact-frontend-origin>
SMTP_HOST=<provider-smtp-host>
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<smtp-username>
SMTP_PASS=<smtp-password>
SMTP_FROM=<verified-sender-address>
```

Use the exact Vercel frontend origin that users will visit (scheme + hostname, no path). Configure a real SMTP mailbox/provider and verify the sender domain. Do not paste secrets into chat, GitHub issues, commits, or Vercel client-side variables.

## Start the API stack

```sh
docker compose -f docker-compose.api.yml config
docker compose -f docker-compose.api.yml up --build -d
docker compose -f docker-compose.api.yml ps
docker compose -f docker-compose.api.yml logs --tail=100 backend
```

The API edge listens only on `127.0.0.1:3001`. Confirm locally:

```sh
curl -fsS http://127.0.0.1:3001/healthz
```

Expected response: `{"status":"ok"}`. PostgreSQL remains private inside the Compose network.

## HTTPS API hostname

Choose a dedicated hostname such as `api.<your-domain>` and point its DNS A record to the new VPS IPv4 address. Do not reuse the Donation Alerts hostname or IP.

Configure the VPS host Nginx with a TLS virtual host for that API hostname. Proxy requests to `http://127.0.0.1:3001`, preserving the request path and the incoming `Origin` header. Forward `Host`, set `X-Real-IP`, and set `X-Forwarded-For`. Obtain and renew the TLS certificate before enabling Vercel to use the API. The API edge only exposes `/api/v1/*` and `/healthz`; other paths return 404.

Verify from outside the VPS:

```sh
curl -fsS https://api.<your-domain>/healthz
```

## Connect Vercel Preview

In the Vercel project, add `API_INTERNAL_URL=https://api.<your-domain>` to the Preview environment for branch `feat/self-hosted-backend`. This is a server-side variable; never prefix it with `VITE_`. Redeploy the Preview after changing it.

Do not add it to Production and do not promote this branch yet.

## Release checks

Before considering the backend ready:

1. `/healthz` returns HTTP 200 over HTTPS.
2. Anonymous `GET /api/v1/auth/me` returns HTTP 401 through the Vercel Preview proxy.
3. Registration sends a real verification email; no development token is exposed.
4. Email verification creates a secure session cookie on the Vercel frontend origin.
5. Login, logout, password recovery, MFA enrollment/verification/disable, and session invalidation pass browser E2E tests.
6. Two-user tests prove workspace/API-key/provider/usage isolation.
7. API-key revocation, provider-key encryption, upstream OpenAI requests, usage logging, rate limits, and backup/restore are tested.
8. PostgreSQL is not reachable from the public internet; only 22/80/443 are externally open.
9. Backups include PostgreSQL and the master key is stored separately and securely. Losing the master key makes encrypted provider credentials and API keys unusable.

## Rollback and data safety

Do not run `docker compose down -v` on a live deployment; it deletes the PostgreSQL volume. Use `docker compose -f docker-compose.api.yml down` without `-v` for a service stop. Take and verify a database backup before schema changes or upgrades.

## Current limitation

The VPS and DNS do not exist yet. The deployment is therefore prepared but not live. Vercel registration will continue to show `API_NOT_CONFIGURED` until the API is deployed, HTTPS is active, and Preview `API_INTERNAL_URL` is configured.
