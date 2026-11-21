# Self-hosted Docker environment

This branch introduces a parallel self-hosted stack for AEVOTRON. It does not
modify Vercel, production domains, DNS, aliases, or production environment
variables.

## Current migration status

The independent Node.js API and PostgreSQL schema live under `backend/`.
The Base44 SDK, Vite plugin, platform function resources, and Base44 entity
definitions have been removed from this branch. The login, registration,
email verification, password recovery, TOTP MFA, workspace, API-key,
provider-connection, model-discovery, and usage screens now call the
same-origin self-hosted API.

Current scope limitations: only TOTP authenticator MFA is implemented (no
SMS), social OAuth is not configured, and OpenAI is the only provider adapter.
The chat endpoint supports non-streaming OpenAI Chat Completions. The
standalone backend still needs deeper browser-level integration testing and
operational hardening before production use.

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
API. PostgreSQL data persists in the `aevotron-postgres` named volume. The
Nitro frontend also has same-origin API proxy routes for deployments where
Nginx is not in front of the app; configure `API_INTERNAL_URL` to an
externally reachable API origin in that environment.

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

These are build and HTTP smoke tests, not a full browser end-to-end suite.
The automated smoke test checks that the API starts and rejects an anonymous
session request. Full email delivery, MFA setup/sign-in, password reset,
provider credential validation, API-key lifecycle, and real upstream model
requests still require integration tests before release.

## Vercel preview and production boundary

The old Base44-specific rewrites have been removed from this branch. TanStack
server routes proxy `/api/v1/*` and `/v1/chat/completions` to
`API_INTERNAL_URL`. A Vercel Preview can use this API only after that
environment variable points to a reachable self-hosted API deployment. The
Docker Compose stack supplies the internal API address automatically.

Vercel Production remains on its existing deployment because this branch is
not merged or deployed to Production. Do not promote this branch until the
self-hosted API is deployed, its Preview environment is configured, and the
browser-level auth and gateway integration suite passes.
