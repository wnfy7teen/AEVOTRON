import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("AI Workspace route uses the session-authenticated streaming client", async () => {
  const route = await read("src/routes/_authed/workspace.jsx");
  const client = await read("src/api/client.js");
  assert.match(route, /createFileRoute\("\/_authed\/workspace"\)/);
  assert.match(route, /api\.workspace\.streamChat/);
  assert.match(route, /onDelta:/);
  assert.match(route, /CircleStop/);
  assert.match(route, /onClick=\{stop\}/);
  assert.match(route, /regenerate/);
  assert.match(route, /Save and resend/);
  assert.match(route, /messages: conversations\.find/);
  assert.match(client, /\/api\/v1\/workspace\/chat\/completions/);
  assert.match(client, /credentials: "include"/);
  assert.match(client, /accept: "text\/event-stream"/);
  assert.doesNotMatch(client, /localStorage.*token|sessionStorage.*token/i);
});

test("AI Workspace discloses estimates instead of inventing provider usage and cost", async () => {
  const route = await read("src/routes/_authed/workspace.jsx");
  assert.match(route, /estimateTokens/);
  assert.match(route, /Not reported/);
  assert.match(route, /Cost and context limits are not inferred/);
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
