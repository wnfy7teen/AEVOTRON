# AEVOTRON

AEVOTRON is a multi-provider AI gateway and workspace application built with React 19, TanStack Start, Vite/Nitro, a self-hosted Node.js API, and PostgreSQL.

## Architecture

- **Frontend:** TanStack Start routes and dashboard in `src/`; Vite/Nitro builds the web application.
- **API:** standalone Node.js service in `backend/` handles authentication, workspaces, provider credentials, AEVOTRON API keys, usage, and the OpenAI-compatible gateway.
- **Database:** PostgreSQL schema and migrations in `backend/migrations/`.
- **Local/self-hosted stack:** Docker Compose runs PostgreSQL, API, Nitro frontend, and an Nginx gateway. The database and API are not exposed directly to the public host; Nginx binds to `127.0.0.1:3000`.
- **Vercel:** serves the frontend. A self-hosted API must be reachable through `API_INTERNAL_URL` before the Vercel Preview can use authenticated backend features.

Base44 runtime dependencies and platform resources are removed from this branch. Do not reintroduce Base44 SDK calls, Vite plugins, function rewrites, or entity resources.

## Run locally

Requirements: Node.js 22+, Docker Engine, and the Docker Compose plugin.

```sh
npm install --no-audit --no-fund
npm run dev
```

To run the complete self-hosted stack:

```sh
cp .env.docker.example .env
# Replace all placeholder secrets with independently generated random values.
openssl rand -hex 24       # POSTGRES_PASSWORD
openssl rand -base64 32    # AEVOTRON_MASTER_KEY (exactly 32 decoded bytes)
openssl rand -hex 32       # IP_HASH_SALT
docker compose up --build -d
```

Open `http://localhost:3000`. For local HTTP development set `COOKIE_SECURE=false` in `.env`; keep it `true` behind HTTPS. Configure SMTP before enabling production registration and password recovery.

## Verification

```sh
npm test
npm run lint
npm run build
npm --prefix backend install --no-audit --no-fund
npm --prefix backend test
sh ./docker-verify.sh
```

GitHub Actions runs the frontend policy tests, backend security tests, lint, production build, and Docker smoke verification on the self-hosted feature branch.

## Current API scope

- Email/password authentication, email verification, password reset, TOTP MFA, and opaque browser sessions.
- Workspace-scoped provider connections and API keys.
- OpenAI and Groq provider connections and non-streaming Chat Completions gateway.
- API keys are shown once and stored as HMAC-SHA-256 digests.
- Provider credentials and TOTP secrets are encrypted with AES-256-GCM.
- Usage and audit records are append-only; prompt and completion content are not persisted.

Streaming, tool calls, embeddings, multimodal requests, additional provider adapters beyond OpenAI and Groq, full browser-level end-to-end coverage, and production operational hardening remain out of scope for this beta.

## Documentation

- `docs/BYOK_BACKEND.md` — current backend architecture, security model, API routes, and limitations.
- `docs/docker-testing.md` — Docker setup, verification, and deployment boundary.
- `docs/TECHNICAL_SPEC.md` — product requirements and technical specification.
- `AGENTS.md` — repository-specific development and security rules.

## Deployment boundary

`feat/self-hosted-backend` is a preview/migration branch. It does not change Vercel Production, production domains, DNS, or live environment variables. Do not merge or promote it until the self-hosted API is deployed, its Preview environment is configured, and the browser-level authentication and gateway integration tests pass.
