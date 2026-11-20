import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const entity = async (name) => JSON.parse(
  await readFile(new URL(`../base44/entities/${name}.jsonc`, import.meta.url), "utf8"),
);

test("workspace ownership cannot be changed by a regular user", async () => {
  const schema = await entity("workspace");
  assert.deepEqual(schema.properties.owner_user_id.rls.write, {
    user_condition: { role: "admin" },
  });
  assert.ok(schema.rls.read.$or.some((rule) => rule["data.owner_user_id"] === "{{user.id}}"));
  assert.deepEqual(schema.rls.delete, { user_condition: { role: "admin" } });
  for (const operation of ["create", "read", "update"]) {
    assert.ok(schema.rls[operation].$or.some((rule) => rule["data.owner_user_id"] === "{{user.id}}"));
  }
});

test("workspace membership mutations are restricted to trusted backend role", async () => {
  const schema = await entity("workspace-member");
  for (const operation of ["create", "update", "delete"]) {
    assert.deepEqual(schema.rls[operation], { user_condition: { role: "admin" } });
  }
  assert.ok(schema.rls.read.$or.some((rule) => rule["data.user_id"] === "{{user.id}}"));
  assert.ok(schema.rls.read.$or.some((rule) => rule["data.owner_user_id"] === "{{user.id}}"));
});

test("provider credentials and API key hashes are admin-only fields", async () => {
  const provider = await entity("provider-connection");
  const apiKey = await entity("api-key");
  for (const field of ["credential_ciphertext", "credential_key_version"]) {
    assert.deepEqual(provider.properties[field].rls.read, { user_condition: { role: "admin" } });
    assert.deepEqual(provider.properties[field].rls.write, { user_condition: { role: "admin" } });
  }
  assert.deepEqual(apiKey.properties.key_hash.rls.read, { user_condition: { role: "admin" } });
  assert.deepEqual(apiKey.properties.key_hash.rls.write, { user_condition: { role: "admin" } });
  for (const schema of [provider, apiKey]) {
    for (const operation of ["create", "update", "delete"]) {
      assert.deepEqual(schema.rls[operation], { user_condition: { role: "admin" } });
    }
    assert.ok(schema.rls.read.$or.some((rule) => rule["data.owner_user_id"] === "{{user.id}}"));
  }
});

test("usage and audit events are append-only", async () => {
  for (const name of ["usage-event", "audit-event"]) {
    const schema = await entity(name);
    assert.equal(schema.rls.update, false);
    assert.equal(schema.rls.delete, false);
    assert.deepEqual(schema.rls.create, { user_condition: { role: "admin" } });
    assert.ok(schema.rls.read.$or.some((rule) => rule["data.owner_user_id"] === "{{user.id}}"));
  }
});

const backendFunction = async (name) => readFile(
  new URL(`../base44/functions/${name}/index.ts`, import.meta.url),
  "utf8",
);

test("provider credentials are validated and encrypted before persistence", async () => {
  const source = await backendFunction("provider-connections");
  assert.match(source, /https:\/\/api\.openai\.com\/v1\/models/);
  assert.match(source, /AES-GCM/);
  assert.match(source, /Deno\.env\.get\("AEVOTRON_MASTER_KEY"\)/);
  assert.match(source, /credential_ciphertext: ciphertext/);
  assert.doesNotMatch(source, /console\.(log|error)\s*\(/);
  assert.doesNotMatch(source, /return json\(\{[^}]*credential_ciphertext/s);
});

test("AEVOTRON API keys are random, HMAC-hashed and only returned at creation", async () => {
  const source = await backendFunction("api-keys");
  assert.match(source, /crypto\.getRandomValues/);
  assert.match(source, /name: "HMAC"/);
  assert.match(source, /key_hash: keyHash/);
  assert.match(source, /scopes_json: JSON\.stringify\(\["chat\.completions"\]\)/);
  assert.match(source, /key: token/);
  assert.match(source, /This key is shown once/);
  assert.doesNotMatch(source, /localStorage/);
});

test("gateway accepts only bounded OpenAI chat requests and never logs prompts", async () => {
  const source = await backendFunction("gateway");
  assert.match(source, /https:\/\/api\.openai\.com\/v1\/chat\/completions/);
  assert.match(source, /raw\.length > 65536/);
  assert.match(source, /input\.stream === true/);
  assert.match(source, /input\.messages\.length > 50/);
  assert.ok(source.includes("Authorization: `Bearer ${credential}`"));
  assert.doesNotMatch(source, /console\.(log|error)\s*\(/);
  assert.doesNotMatch(source, /prompt:\s*input\.messages/);
});

test("usage analytics are workspace-scoped and never persist prompt content", async () => {
  const source = await backendFunction("usage");
  assert.match(source, /owner_user_id: user\.id, workspace_id: workspace\.id/);
  assert.match(source, /"input_tokens", "output_tokens"/);
  assert.match(source, /"latency_ms", "status_code", "error_code"/);
  assert.doesNotMatch(source, /console\.(log|error)\s*\(/);
  assert.doesNotMatch(source, /messages|prompt|completion_content/i);
});

test("gateway checks API key scopes and applies a documented per-key request guard", async () => {
  const source = await backendFunction("gateway");
  assert.match(source, /scopes\.includes\("chat\.completions"\)/);
  assert.match(source, /recentUsage = await entities\.UsageEvent\.filter/);
  assert.match(source, /recentCount >= 30/);
  assert.match(source, /rate_limit_exceeded/);
  assert.match(source, /not a distributed concurrency limit/);
});

test("API key management bounds active keys and rejects control characters in names", async () => {
  const source = await backendFunction("api-keys");
  assert.match(source, /activeKeys\.length >= 20/);
  assert.match(source, /code < 32 \|\| code === 127/);
});

test("provider model discovery is owner-scoped and uses the encrypted OpenAI connection", async () => {
  const source = await backendFunction("provider-connections");
  assert.match(source, /action === "models"/);
  assert.match(source, /decryptCredential\(/);
  assert.match(source, /https:\/\/api\.openai\.com\/v1\/models/);
  assert.match(source, /chatgpt-/);
  assert.doesNotMatch(source, /return json\(\{[^}]*credential_ciphertext/s);
});

test("gateway API bearer keys are not reused as Base44 session credentials", async () => {
  const source = await backendFunction("gateway");
  assert.match(source, /serviceHeaders\.delete\("authorization"\)/);
  assert.match(source, /createClientFromRequest\(serviceRequest\)/);
});
