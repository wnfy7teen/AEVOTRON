import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getProvider, isValidProviderCredential, normalizeProviderModels } from "../src/providers.js";

test("OpenAI and Groq use fixed HTTPS OpenAI-compatible API origins", () => {
  assert.equal(getProvider("openai").baseUrl, "https://api.openai.com/v1");
  assert.equal(getProvider("groq").baseUrl, "https://api.groq.com/openai/v1");
  assert.equal(getProvider("custom"), null);
});

test("provider credentials are validated against the selected provider prefix", () => {
  assert.equal(isValidProviderCredential("groq", "gsk_" + "a".repeat(32)), true);
  assert.equal(isValidProviderCredential("openai", "sk-" + "a".repeat(32)), true);
  assert.equal(isValidProviderCredential("groq", "sk-" + "a".repeat(32)), false);
  assert.equal(isValidProviderCredential("openai", "gsk_" + "a".repeat(32)), false);
  assert.equal(isValidProviderCredential("groq", "gsk_" + "a".repeat(10)), false);
  assert.equal(isValidProviderCredential("groq", "gsk_" + "a".repeat(30) + " "), false);
});

test("provider model IDs are namespaced and non-chat Groq models are excluded", () => {
  const groq = normalizeProviderModels("groq", [
    { id: "llama-3.3-70b-versatile", owned_by: "Meta", active: true },
    { id: "whisper-large-v3", owned_by: "OpenAI", active: true },
    { id: "llama-3.1-8b-instant", active: false },
  ]);
  assert.deepEqual(groq, [{
    id: "groq/llama-3.3-70b-versatile",
    provider_model_id: "llama-3.3-70b-versatile",
    owned_by: "Meta",
    provider_code: "groq",
  }]);
  const openai = normalizeProviderModels("openai", [
    { id: "gpt-4o-mini" },
    { id: "text-embedding-3-small" },
  ]);
  assert.deepEqual(openai.map((model) => model.id), ["openai/gpt-4o-mini"]);
});

test("server routes provider credentials and chat requests through the selected adapter", async () => {
  const server = await readFile(new URL("../src/server.js", import.meta.url), "utf8");
  assert.ok(server.includes("path.match(/^\\/api\\/v1\\/providers\\/(openai|groq)"));
  assert.ok(server.includes('provider:" + provider.code + ":" + user.id + ":" + workspace.id'));
  assert.ok(server.includes('providerConfig.baseUrl + "/chat/completions"'));
  assert.ok(server.includes("body.model.match(/^(openai|groq)\\/(.+)$/)"));
  assert.ok(!server.includes("provider_code='openai' AND status='active'"));
});
