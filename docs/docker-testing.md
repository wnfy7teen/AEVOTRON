# Self-hosted Docker environment

This branch introduces a parallel self-hosted stack for AEVOTRON. It does not
modify Vercel, production domains, DNS, aliases, or production environment
variables.

## Current migration status

The independent Node.js API and PostgreSQL schema are scaffolded under
`backend/`. The API includes email/password registration and verification,
session cookies, password reset, TOTP MFA, workspaces, API-key management,
encrypted OpenAI credentials, usage records, and an OpenAI-compatible
non-streaming chat completion endpoint.

**The existing React pages are not yet migrated.** They still import the
Base44 SDK and call Base44 auth/entities/functions. A successful container
smoke test currently proves that the frontend can start and that the new API
responds, but it does not mean the browser UI has stopped depending on Base44.
Do not treat this branch as a production-ready replacement until the frontend
adapter, all page flows, and integration tests have been migrated.

## Configure locally

Requirements: Docker Engine and the Docker Compose plugin.

```sh
cp .env.docker.example .env
```

Generate three independent secrets. The master key must decode to exactly 32
bytes:

```sh
openssl rand -hex 24       # POSTGRES_PASSWORD
openssl rand -base64 32    # AEVOTRON_MASTER_KEY
openssl rand -hex 32       # IP_HASH_SALT
```

Put the generated values in `.env`, then set `PUBLIC_APP_URL` to the local
or private preview origin. For local HTTP use `COOKIE_SECURE=false`; use
`COOKIE_SECURE=true` behind HTTPS.

SMTP is required for production registration and password recovery. Configure
`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and
`SMTP_FROM`. Never place provider credentials or the master key in Vite
`VITE_*` variables, Docker build arguments, the browser bundle, or Git.

Start the stack:

```sh
docker compose up --build -d
```

Open http://localhost:3000. The gateway sends page traffic to the Nitro
frontend and `/api/v1/*` plus `/v1/chat/completions` to the independent Node
API. PostgreSQL data persists in the `aevotron-postgres` named volume.

Stop without deleting database data:

```sh
docker compose down
```

To destroy the local database volume as well, use
`docker compose down -v`. This is destructive.

## Backend details

- Passwords use Node.js scrypt with per-user random salts.
- Browser sessions use opaque random tokens; only SHA-256 token hashes are
  stored in PostgreSQL. Session cookies are HttpOnly and SameSite=Lax.
- MFA uses TOTP; pending secrets and provider credentials are encrypted with
  AES-256-GCM and bound to account/workspace context.
- AEVOTRON API keys are random, shown once, and stored as HMAC-SHA-256 digests.
- Usage and audit events are append-only at the database level.
- Auth and gateway rate-limit counters are stored in PostgreSQL so concurrent
  API instances share the counters.
- The API does not persist prompt or completion text in usage/audit records.
- `AEVOTRON_MASTER_KEY` is essential to decrypt provider credentials and
  verify AEVOTRON API keys. Back it up securely; losing it makes stored
  credentials and API keys unusable.

The current gateway supports OpenAI Chat Completions without streaming and
allows the existing `chat.completions` scope. Provider model discovery and
additional provider adapters are not yet migrated.

## Verification

```sh
npm --prefix backend install --no-audit --no-fund
npm --prefix backend test
sh ./docker-verify.sh
```

The backend unit tests cover password hashing, API-key generation, encrypted
credential context binding, and RFC 6238 TOTP behavior. The Docker smoke test
starts PostgreSQL, the API, frontend, and Nginx gateway; checks homepage HTML,
all same-origin JS/CSS assets, the declared app routes, and verifies that
unauthenticated `/api/v1/auth/me` returns HTTP 401.

These are build and smoke tests, not a full browser end-to-end suite. Email
delivery, MFA setup/sign-in, password reset, API-key lifecycle, provider
connection, and real upstream model requests still require integration tests
before release.

## Production boundary

Vercel remains the production serving platform. The self-hosted stack lives on
`feat/self-hosted-backend` and is not deployed or merged. No Production
configuration or live domain is changed by this branch.
