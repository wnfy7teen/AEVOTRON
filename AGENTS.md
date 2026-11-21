# AEVOTRON repository instructions

## Project architecture

- AEVOTRON is a React 19 + TanStack Start application built with Vite/Nitro. Routes and UI live under `src/`; JavaScript and TSX are both used.
- The self-hosted API is a separate Node.js service under `backend/`. PostgreSQL schema and migrations live in `backend/migrations/`.
- The browser uses same-origin `/api/v1/*` routes for account/workspace operations and `/v1/chat/completions` for the model gateway.
- Docker Compose runs PostgreSQL, the API, Nitro frontend, and Nginx. Vercel serves the frontend; Preview requires `API_INTERNAL_URL` to point to a reachable self-hosted API.
- This branch has removed Base44 SDKs, plugins, entities, functions, and rewrites. Do not reintroduce Base44 runtime dependencies or code.

## Security requirements

- Treat all browser input as untrusted. Validate request types, lengths, enums, and ownership on the backend.
- Never accept a client-supplied owner ID as authority. Derive the user from the verified session and resolve workspace membership server-side.
- Use parameterized SQL for every database query. Keep workspace and owner predicates on every user-scoped read/write.
- Never expose password hashes, session hashes, provider ciphertext, API-key HMAC digests, master keys, or SMTP credentials to the browser.
- Passwords use the fixed scrypt parameters in `backend/src/security.js`; do not accept stored hash parameters as caller-controlled work factors.
- Provider credentials and TOTP secrets must remain AES-256-GCM encrypted with account/workspace context in AAD.
- AEVOTRON API keys are high-entropy random tokens, displayed once, and stored only as keyed HMAC digests.
- Session cookies must be HttpOnly and SameSite=Lax. Keep `COOKIE_SECURE=true` for HTTPS/production; set it false only for local HTTP development.
- `AEVOTRON_MASTER_KEY` must decode from Base64 to exactly 32 random bytes. `IP_HASH_SALT` must be independently generated. Neither belongs in Vite `VITE_*` variables, source code, Docker build arguments, or logs.
- Do not log Authorization headers, cookies, provider credentials, API keys, prompts, or completion contents.
- Usage and audit events are append-only. Do not add prompt/completion content to usage or audit metadata.
- Preserve database-backed rate limiting and one-time token/challenge consumption. New auth flows need expiry, replay protection, and rate-limit coverage.

## API and product scope

- Current provider adapter: OpenAI only.
- Current gateway: non-streaming text Chat Completions. Do not claim streaming, tool calls, embeddings, or multimodal support until implemented and tested.
- Do not add arbitrary upstream URLs without SSRF controls, HTTPS validation, and private/link-local address blocking.
- Provider model availability and user access must be checked server-side; UI visibility is not authorization.

## UI and localization

- Keep the interface responsive for desktop and mobile.
- Supported UI languages are English (`en`), Russian (`ru`), and Simplified Chinese (`zh`). Add user-visible strings to the translation dictionaries in `src/lib/i18n.jsx`; keep language switching live without requiring a reload.
- Respect reduced-motion preferences for decorative animations and keep keyboard focus/ARIA behavior intact.
- Preserve the existing AEVOTRON theme tokens and contrast requirements when editing landing or dashboard styles.

## Verification commands

Run the relevant checks before considering a change complete:

```sh
npm test
npm run lint
npm run build
npm --prefix backend install --no-audit --no-fund
npm --prefix backend test
node --check backend/src/server.js
node --check backend/src/security.js
sh ./docker-verify.sh
```

GitHub Actions CI runs frontend policy tests, backend security tests, syntax checks, lint, and the production build. Docker verification builds and starts the full stack, then checks the homepage, same-origin assets, app routes, and anonymous API authorization.

## Deployment safety

- Work on the requested feature branch and keep changes scoped.
- Vercel Preview builds are for validation only. Do not merge to `main`, promote a deployment, change production domains/DNS, or modify production environment variables without explicit approval.
- The self-hosted backend is not production-ready until the API is deployed, Preview connectivity is configured, and browser-level tests cover registration, email verification, MFA, password reset, provider connection, API-key lifecycle, and real upstream requests.
- Never claim a feature or deployment is verified solely because the Vite build succeeded; check CI, Docker smoke tests, and relevant runtime behavior.
