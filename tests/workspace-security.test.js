import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("PostgreSQL schema defines isolated users, sessions and workspaces", async () => {
  const sql = await read("backend/migrations/001_initial.sql");
  for (const table of ["users", "sessions", "email_verification_tokens", "password_reset_tokens", "mfa_factors", "workspaces", "workspace_members"]) {
    assert.match(sql, new RegExp("CREATE TABLE IF NOT EXISTS " + table + "\\b"));
  }
  assert.match(sql, /email_normalized TEXT NOT NULL UNIQUE/);
  assert.match(sql, /token_hash BYTEA NOT NULL UNIQUE/);
  assert.match(sql, /owner_user_id UUID NOT NULL REFERENCES users\(id\)/);
});

test("provider credentials use authenticated encryption with contextual binding", async () => {
  const source = await read("backend/src/security.js");
  const server = await read("backend/src/server.js");
  assert.match(source, /aes-256-gcm/);
  assert.match(source, /setAAD/);
  assert.match(source, /getAuthTag/);
  assert.match(server, /encryptSecret\(credential, aad\)/);
  assert.match(server, /decryptSecret\(provider\.rows\[0\]\.credential_ciphertext/);
});

test("AEVOTRON API keys are generated randomly and HMAC-hashed", async () => {
  const source = await read("backend/src/security.js");
  const server = await read("backend/src/server.js");
  assert.match(source, /randomBytes\(32\)/);
  assert.match(source, /createHmac\("sha256"/);
  assert.match(source, /mh_live_/);
  assert.match(server, /apiKeyHash\(token\)/);
  assert.match(server, /This key is shown once/);
});

test("usage and audit events are append-only and do not store prompt content", async () => {
  const sql = await read("backend/migrations/001_initial.sql");
  const server = await read("backend/src/server.js");
  assert.match(sql, /CREATE TRIGGER usage_events_immutable BEFORE UPDATE OR DELETE/);
  assert.match(sql, /CREATE TRIGGER audit_events_immutable BEFORE UPDATE OR DELETE/);
  assert.match(sql, /input_tokens INTEGER NOT NULL DEFAULT 0/);
  assert.doesNotMatch(server, /console\.log\([^)]*messages/);
  assert.doesNotMatch(server, /INSERT INTO usage_events[^;]*(messages|prompt|completion_content)/i);
});

test("gateway rejects unbounded payloads and streaming until streaming support is implemented", async () => {
  const server = await read("backend/src/server.js");
  assert.match(server, /const JSON_LIMIT = 64 \* 1024/);
  assert.match(server, /input\.stream === true/);
  assert.match(server, /input\.messages\.length > 50/);
  assert.match(server, /api_key_rate_limits/);
  assert.match(server, /rate_limit_exceeded/);
});

test("Docker stack isolates PostgreSQL and API behind the Nginx gateway", async () => {
  const compose = await read("docker-compose.yml");
  const nginx = await read("docker/nginx.conf");
  assert.match(compose, /image: postgres:17-alpine/);
  assert.match(compose, /image: aevotron-api:local/);
  assert.match(compose, /127\.0\.0\.1:3000:3000/);
  assert.match(compose, /read_only: true/);
  assert.match(nginx, /location \/api\/v1\//);
  assert.match(nginx, /proxy_pass http:\/\/backend:3001/);
  assert.match(nginx, /location = \/v1\/chat\/completions/);
});

test("frontend build has no Base44 SDK, platform function or rewrite dependency", async () => {
  const pkg = JSON.parse(await read("package.json"));
  const vite = await read("vite.config.js");
  const api = await read("src/api/client.js");
  assert.equal(pkg.dependencies["@base44/sdk"], undefined);
  assert.equal(pkg.dependencies["@base44/vite-plugin"], undefined);
  assert.doesNotMatch(vite, /@base44/);
  assert.doesNotMatch(api, /base44\.app|app\.base44\.com/);
});

test("Docker configuration enables Secure session cookies by default", async () => {
  const compose = await read("docker-compose.yml");
  const envExample = await read(".env.docker.example");
  assert.ok(compose.includes("COOKIE_SECURE: ${COOKIE_SECURE:-true}"));
  assert.match(envExample, /^COOKIE_SECURE=true$/m);
});
