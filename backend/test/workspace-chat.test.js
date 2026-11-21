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
  assert.match(route, /workspace_chat_messages/);
  assert.match(route, /x-chat-session-id/);
  assert.match(route, /body\.session_id/);
  assert.match(route, /persist_conversation/);
  assert.match(route, /replace_last_user_message/);
  assert.match(route, /CHAT_MESSAGE_NOT_FOUND/);
  assert.match(route, /Non-persistent requests cannot target a saved conversation/);
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

test("Workspace chat sessions are scoped to the authenticated user and workspace", async () => {
  const server = await readFile(new URL("../src/server.js", import.meta.url), "utf8");
  const start = server.indexOf('path === "/api/v1/workspace/chats"');
  const end = server.indexOf("// First-party Workspace chat", start);
  const routes = server.slice(start, end);
  assert.match(routes, /requireUser\(req, res\)/);
  assert.match(routes, /currentWorkspace\(user\)/);
  assert.match(routes, /workspace_id=\$[0-9]/);
  assert.match(routes, /owner_user_id=\$[0-9]/);
  assert.match(routes, /CHAT_NOT_FOUND/);
  assert.match(routes, /DELETE FROM workspace_chat_sessions/);
});
