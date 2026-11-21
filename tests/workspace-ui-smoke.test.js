import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("workspace navigation exposes all primary account sections", async () => {
  const source = await read("src/routes/_authed/dashboard.jsx");
  for (const section of ["Overview", "Model catalog", "API keys", "Usage & logs", "Billing", "Team & projects", "Notifications", "Providers", "Preferences"]) {
    assert.ok(source.includes(`name: "${section}"`) || source.includes(`section === "${section}"`), `Missing workspace section: ${section}`);
  }
});

test("settings screen includes profile, security, notification, billing, API, appearance and danger-zone panels", async () => {
  const source = await read("src/routes/_authed/dashboard.jsx");
  for (const panel of ["Profile", "Security", "Notifications", "Billing", "API", "Appearance", "Danger zone"]) {
    assert.ok(source.includes(`name:"${panel}"`) || source.includes(`tab==="${panel}"`), `Missing settings panel: ${panel}`);
  }
  assert.match(source, /aevotron-workspace-settings/);
  assert.match(source, /aevotron-avatar/);
  assert.match(source, /aria-checked=\{!!settings\[key\]\}/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /Type DELETE to confirm/);
});

test("preview billing, team and notification actions update local component state", async () => {
  const source = await read("src/routes/_authed/dashboard.jsx");
  assert.match(source, /setBalance\(value=>value\+Number\(amount\)\)/);
  assert.match(source, /setMembers\(list=>\[\.\.\.list/);
  assert.match(source, /setItems\(list=>list\.map/);
  assert.match(source, /setItems\(list=>list\.filter/);
});

test("settings layout supports narrow screens and reduced motion", async () => {
  const css = await read("src/apple-style.css");
  assert.match(css, /@media\(max-width:850px\)/);
  assert.match(css, /@media\(max-width:560px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /\.av-settings-tabs/);
  assert.match(css, /\.av-modal-backdrop/);
});

test("settings clearly disclose local-only security and account controls", async () => {
  const source = await read("src/routes/_authed/dashboard.jsx");
  assert.match(source, /Local preview settings\./);
  assert.match(source, /api\.auth\.mfaStatus/);
  assert.match(source, /api\.auth\.mfaEnroll/);
  assert.match(source, /api\.auth\.mfaConfirm/);
  assert.match(source, /api\.auth\.mfaDisable/);
  assert.match(source, /Preview session removed from this list/);
});

test("credential revocations require confirmation and frontend actions map to backend routes", async () => {
  const dashboard = await read("src/routes/_authed/dashboard.jsx");
  const client = await read("src/api/client.js");
  assert.match(dashboard, /Revoke this API key\?/);
  assert.match(dashboard, /Revoke the OpenAI provider connection\?/);
  assert.match(client, /\/api\/v1\/api-keys\//);
  assert.match(client, /expires_at/);
  assert.match(client, /api_key: payload\.credential/);
  assert.match(client, /\/api\/v1\/providers\/openai/);
});
