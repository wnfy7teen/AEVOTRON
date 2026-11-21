import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("AI Workspace route uses the session-authenticated streaming client", async () => {
  const route = await read("src/routes/_authed/workspace.jsx");
  const client = await read("src/api/client.js");
  assert.match(route, /createFileRoute\("\/_authed\/workspace"\)/);
  assert.match(route, /api\.workspace\.streamChat/);
  assert.match(route, /api\.workspace\.listChats/);
  assert.match(route, /api\.workspace\.getChat/);
  assert.match(route, /api\.workspace\.createChat/);
  assert.match(route, /api\.workspace\.renameChat/);
  assert.match(route, /api\.workspace\.deleteChat/);
  assert.match(route, /onDelta:/);
  assert.match(route, /CircleStop/);
  assert.match(route, /onClick=\{stop\}/);
  assert.match(route, /regenerate/);
  assert.match(route, /Save and resend/);
  assert.match(route, /setMessages\(conversations\.find/);
  assert.match(client, /\/api\/v1\/workspace\/chat\/completions/);
  assert.match(client, /credentials: "include"/);
  assert.match(client, /accept: "text\/event-stream"/);
  assert.match(client, /persist_conversation/);
  assert.match(route, /Compare model responses/);
  assert.match(route, /Promise\.allSettled/);
  assert.match(route, /Stop comparison/);
  assert.match(route, /persist_user_message: false/);
  assert.match(route, /replaceLastUserMessage: true/);
  assert.match(route, /exportConversation/);
  assert.match(route, /branchFromMessage/);
  assert.match(route, /assistant_message_id: assistantId/);
  assert.match(route, /addFiles/);
  assert.match(route, /selectedAttachmentIds/);
  assert.match(route, /selectedAttachments\.map/);
  assert.match(route, /sentAttachmentIds/);
  assert.match(route, /filter\(\(file\) => !sentAttachmentIds\.has\(file\.id\)\)/);
  assert.match(route, /Include attachment/);
  assert.match(route, /512 KB/);
  assert.match(route, /12_000/);
  assert.match(route, /onDrop=/);
  assert.match(route, /Branch here/);
  assert.match(client, /branchChat/);
  assert.match(route, /Retry/);
  assert.doesNotMatch(client, /localStorage.*token|sessionStorage.*token/i);
});

test("AI Workspace discloses estimates instead of inventing provider usage and cost", async () => {
  const route = await read("src/routes/_authed/workspace.jsx");
  assert.match(route, /estimateTokens/);
  assert.match(route, /selectContextMessages/);
  assert.match(route, /workspace-chat-usage/);
  assert.match(route, /Session usage/);
  assert.match(route, /sessionUsage\.usage_estimated/);
  assert.match(route, /finally \{[\s\S]*queryClient\.invalidateQueries/);
  assert.match(route, /shouldAutoScrollRef/);
  assert.match(route, /threadRef/);
  assert.match(route, /favoriteModels/);
  assert.match(route, /providerGroups/);
  assert.match(route, /modelCapabilities/);
  assert.match(route, /Model metadata not verified/);
  assert.match(route, /recentModels/);
  assert.match(route, /aevotron\.workspace\.favorites/);
  assert.match(route, /Search models/);
  assert.match(route, /tokenBudget = 24_000/);
  assert.match(route, /Older messages omitted from this request/);
  assert.match(route, /Not reported/);
  assert.match(route, /Cost and context limits are not inferred/);
  assert.match(route, /context_window/);
  assert.match(route, /Provider usage/);
  assert.match(route, /generationMs/);
  assert.match(route, /estimatedOutputTokens/);
});

test("AI Workspace styles support both themes, mobile layout, focus and reduced motion", async () => {
  const css = await read("src/apple-style.css");
  assert.match(css, /\.aw-shell/);
  assert.match(css, /html\[data-theme="dark"\] \.aw-shell/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /\.aw-shell button:focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test("AI Workspace is available from the authenticated dashboard navigation", async () => {
  const dashboard = await read("src/routes/_authed/dashboard.jsx");
  assert.match(dashboard, /name: "AI Workspace"/);
  assert.match(dashboard, /window\.location\.assign\("\/workspace"\)/);
});

test("Cloudflare API proxy keeps streaming open for the backend timeout and forwards the response body", async () => {
  const proxy = await read("src/routes/api/v1/$.js");
  assert.match(proxy, /AbortSignal\.timeout\(125_000\)/);
  assert.match(proxy, /return new Response\(upstream\.body/);
});
