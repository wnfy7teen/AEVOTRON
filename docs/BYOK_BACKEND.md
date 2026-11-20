# AEVOTRON BYOK backend

## Current architecture

- The Vercel application serves the dashboard and proxies Base44 function calls.
- Base44 app: `ModelHub` (`6afee6f0926a08905539d9ce`).
- Base44 app domain: `https://model-hub-5539d9ce.base44.app`.
- Base44 backend functions are deployed separately from the Vercel frontend.
- Vercel rewrites `/api/apps/:appId/functions/:functionName` to the Base44 app domain and routes `/v1/chat/completions` to the `gateway` function.

The Base44 app has not been published yet. Its visibility is configured as `public_with_login`; publishing it is a separate action and must be approved before the default app domain can be treated as a live endpoint. Vercel Production is not changed by this branch.

## Backend functions

| Function | Purpose |
|---|---|
| `provider-connections` | List, connect, test, revoke and discover OpenAI models |
| `api-keys` | Create, list and revoke AEVOTRON API keys |
| `gateway` | OpenAI Chat Completions proxy with per-key usage records |
| `usage` | Workspace-scoped usage summaries and metadata-only request history |

All user-management functions require an authenticated Base44 user. They derive the workspace from the authenticated user and never accept a client-supplied owner ID.

## Secret management

The Base44 Secret Storage contains `AEVOTRON_MASTER_KEY`, a 32-byte random key encoded as Base64.

- Provider credentials are encrypted with AES-256-GCM.
- Encryption and API-key HMAC subkeys are derived using HKDF-SHA-256 with separate context labels.
- Credential ciphertext is bound to the owner, workspace and provider through AES-GCM additional authenticated data.
- AEVOTRON API keys are generated from cryptographically secure random bytes. Only an HMAC-SHA-256 digest is stored.
- The full AEVOTRON key is returned once at creation. It is not retrievable afterward.
- The master key backup must be stored securely outside the repository. Losing it makes existing encrypted provider credentials unreadable and invalidates existing AEVOTRON API keys.

Never put provider credentials, the master key or full AEVOTRON API keys in Git, browser storage, logs or support messages.

## Data access

Workspace and membership records are owner-scoped. Provider connection and API key records can be read by their owner, but credential ciphertext and API-key hashes are restricted to trusted backend/admin access. Usage and audit records are append-only for normal users; users can read only their own workspace records.

Usage records contain request metadata (model, token counts, latency, status and error code). Prompt and completion contents are not stored.

## Current API beta

Endpoint after the Base44 app is published and the Vercel rewrite is deployed:

`POST https://<AEVOTRON-domain>/v1/chat/completions`

Example:

```bash
curl https://<AEVOTRON-domain>/v1/chat/completions \
  -H "Authorization: Bearer mh_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

Current limits:

- OpenAI only; other provider adapters are not implemented.
- Text chat only. Streaming, tool calls, embeddings, image/audio and multimodal requests are not supported.
- Request body maximum: 64 KB; up to 50 messages; text content is validated.
- `max_tokens` is capped at 4096.
- Best-effort limit: 30 requests/minute per API key. This is not an atomic distributed limiter; replace it with a durable atomic limiter before high-volume/public launch.
- No platform price markup or cost estimate is calculated. The provider bills the connected OpenAI account directly.
- API keys expire after 30, 90 or 365 days; default is 90 days. A workspace can have at most 20 active keys.

Do not advertise this beta as a complete OpenAI API replacement.

## Deployment checklist

1. Keep this work on `feat/apple-style-landing`.
2. Publish the Base44 app only after explicit approval; its visibility is already set to `public_with_login`.
3. Verify the Base44 default domain and all four function invocations.
4. Deploy the Vercel Preview and verify the proxy rewrites and dashboard interactions.
5. Test provider connect/test/revoke with a provider key entered only in the dashboard.
6. Create and revoke a test AEVOTRON key; verify that the full value is shown once.
7. Send a test Chat Completions request; verify usage metadata and absence of prompt content in logs.
8. Do not merge to GitHub `main` or deploy Vercel Production without separate approval.

## Known follow-up work

- Replace the best-effort rate guard with an atomic distributed limiter and add per-key daily/monthly budgets.
- Add provider adapters for Anthropic, Google and other compatible services.
- Add a public `/v1/models` endpoint and additional OpenAI-compatible routes.
- Add streaming and tool-call support only after the gateway has robust cancellation, metering and limits.
- Resolve the documented race risk in first-time workspace provisioning with an atomic unique/upsert mechanism.
