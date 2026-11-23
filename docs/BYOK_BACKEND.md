# AEVOTRON BYOK backend

## Architecture

- TanStack Start serves the dashboard and same-origin API proxy routes.
- The standalone Node.js API in `backend/src/server.js` owns authentication, workspaces, provider connections, AEVOTRON API keys, usage records, and the model gateway.
- PostgreSQL stores users, sessions, MFA factors, workspaces, provider connections, API-key digests, usage events, audit events, and rate-limit buckets.
- Docker Compose runs PostgreSQL, the API, Nitro frontend, and Nginx. Nginx routes `/api/v1/*` and `/v1/chat/completions` to the API.
- Vercel Preview can use the self-hosted API only when `API_INTERNAL_URL` points to a reachable API origin.

Base44 is not part of this branch. Do not use Base44 SDKs, Base44 functions/entities, Base44 rewrites, or Base44 secret storage.

## Authentication and security

- Passwords use Node.js scrypt with per-user random 16-byte salts and fixed cost parameters.
- Browser sessions use opaque random tokens; only SHA-256 token hashes are stored in PostgreSQL.
- Session cookies are HttpOnly and SameSite=Lax. `COOKIE_SECURE=true` is the default and must remain enabled behind HTTPS; disable it only for local HTTP development.
- Email verification and password-reset tokens are random, hashed at rest, time-limited, and consumed once.
- MFA uses TOTP. Pending and confirmed TOTP secrets are encrypted at rest.
- Provider credentials and TOTP secrets use AES-256-GCM with account/workspace context in authenticated additional data.
- `AEVOTRON_MASTER_KEY` must be Base64 that decodes to exactly 32 random bytes. It is required to decrypt provider credentials and verify AEVOTRON API keys.
- AEVOTRON API keys are random `mh_live_...` tokens. The full token is shown once; only a keyed HMAC-SHA-256 digest and short prefix are stored.
- `IP_HASH_SALT` is required by the Docker configuration. It prevents raw client IP addresses from being stored in rate-limit buckets.
- Usage and audit events are append-only at the database level. Prompt and completion bodies are not written to usage/audit records.
- Auth and API-key rate-limit counters are stored in PostgreSQL so multiple API instances share limits.

Never place the master key, provider credentials, session tokens, or full AEVOTRON API keys in `VITE_*` variables, browser storage, client responses after initial creation, logs, Docker build arguments, or Git.

## API routes

| Route | Purpose |
| --- | --- |
| `POST /api/v1/auth/register` | Register an account and start email verification |
| `POST /api/v1/auth/verify-email` | Verify the email address |
| `POST /api/v1/auth/login` | Create a session or request MFA verification |
| `POST /api/v1/auth/mfa/verify-login` | Complete a TOTP login challenge |
| `POST /api/v1/auth/logout` / `GET /api/v1/auth/me` | End or inspect the current session |
| `POST /api/v1/auth/password/forgot` / `POST /api/v1/auth/password/reset` | Password recovery |
| `GET /api/v1/auth/mfa/status`, `POST /api/v1/auth/mfa/enroll`, `/confirm`, `/disable` | Manage TOTP MFA |
| `GET /api/v1/workspaces/current`, `POST /api/v1/workspaces` | Read or create a workspace |
| `GET /api/v1/api-keys`, `POST /api/v1/api-keys` | List or create workspace API keys |
| `/api/v1/providers/openai`, `/api/v1/providers/groq` | Connect, test, or revoke provider credentials |
| `GET /api/v1/providers`, `GET /api/v1/providers/{openai|groq}/models`, `/api/v1/models` | List provider connections and available models |
| `GET /api/v1/usage/summary`, `/api/v1/usage/events` | Read usage summaries and metadata-only events |
| `POST /v1/chat/completions` | OpenAI-compatible gateway endpoint |

## Current gateway limitations

- OpenAI and Groq adapters are implemented using fixed HTTPS provider origins and OpenAI-compatible Chat Completions APIs.
- Model IDs are namespaced as `openai/{model-id}` or `groq/{model-id}` so the gateway can route requests to the correct connected provider.
- Chat Completions supports non-streaming text requests only.
- Streaming, tool calls, embeddings, image/audio/video, and other multimodal requests are rejected until explicitly implemented and tested.
- Request size, message count, output-token limits, API-key scope, and per-key rate limits are enforced server-side.
- No platform-funded API balance or markup is implemented; the connected provider bills its own account.
- Groq API base URL: `https://api.groq.com/openai/v1`; the backend fetches the provider model catalog and stores the user's credential encrypted with workspace-bound AES-256-GCM AAD.
- The gateway does not yet provide complete OpenAI API parity or a public `/v1/models` contract for every provider.

Do not market this beta as a full OpenAI-compatible replacement or promise availability in regions not supported by the upstream provider.

## Local setup

```sh
cp .env.docker.example .env
openssl rand -hex 24       # POSTGRES_PASSWORD
openssl rand -base64 32    # AEVOTRON_MASTER_KEY
openssl rand -hex 32       # IP_HASH_SALT
docker compose up --build -d
```

Set `PUBLIC_APP_URL` to the public HTTPS origin and keep `COOKIE_SECURE=true` for any non-local deployment. Configure SMTP for production registration and password recovery. Back up `AEVOTRON_MASTER_KEY` securely outside the repository; losing it makes existing provider credentials and AEVOTRON API keys unusable.

## Verification

```sh
npm test
npm run lint
npm run build
npm --prefix backend install --no-audit --no-fund
npm --prefix backend test
sh ./docker-verify.sh
```

The Docker smoke test starts the full stack, checks homepage HTML and same-origin assets, exercises the declared app routes, and verifies that an anonymous session request receives HTTP 401. Unit tests cover password hashing, malformed password-hash rejection, API-key generation, authenticated encryption/context binding, and RFC 6238 TOTP.

These checks are not a substitute for browser-level end-to-end testing of email delivery, MFA enrollment/login, password recovery, provider credential validation, API-key revocation, and real upstream model requests.

## Deployment boundary

This branch is a self-hosted migration/Preview branch. Vercel Production, production domains, DNS, aliases, and production environment variables remain unchanged. Do not promote this branch until the API is deployed, `API_INTERNAL_URL` is configured for Preview, and browser-level authentication and gateway integration tests pass.
