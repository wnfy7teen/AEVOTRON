import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Workspace chat is session-authenticated and streams through connected providers", async () => {
  const server = await readFile(new URL("../src/server.js", import.meta.url), "utf8");
  const route = server.split('path === "/api/v1/workspace/chat/completions"')[1]?.split('path === "/api/v1/chat/completions"')[0] || "";
  assert.ok(route, "Workspace chat route must exist");
  assert.match(route, /requireUser\(req, res\)/);
  assert.match(route, /currentWorkspace\(user\)/);
  assert.match(route, /provider_connections/);
  assert.match(route, /decryptSecret\(/);
  assert.match(route, /stream: true/);
  assert.match(route, /text\/event-stream/);
  assert.match(route, /AbortController/);
  assert.match(route, /AbortSignal\.timeout\(120_000\)/);
  assert.match(route, /client_cancelled/);
  assert.match(route, /INSERT INTO usage_events/);
  assert.doesNotMatch(route, /parseApiKeyBearer|mh_live_/);
});

test("Workspace chat validates the selected model and limits requests", async () => {
  const server = await readFile(new URL("../src/server.js", import.meta.url), "utf8");
  const route = server.split('path === "/api/v1/workspace/chat/completions"')[1]?.split('path === "/api/v1/chat/completions"')[0] || "";
  assert.match(route, /validateChat\(\{ \.\.\.body, stream: false \}\)/);
  assert.match(route, /\^\(openai\|groq\)\\\//);
  assert.match(route, /rateLimit\(req, "workspace-chat:" \+ user\.id, 20, 60\)/);
  assert.match(route, /streaming_required/);
});
