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

test("settings clearly disclose backend-connected and local-only account controls", async () => {
  const source = await read("src/routes/_authed/dashboard.jsx");
  assert.match(source, /Account settings status\./);
  assert.match(source, /api\.auth\.mfaStatus/);
  assert.match(source, /api\.auth\.mfaEnroll/);
  assert.match(source, /api\.auth\.mfaConfirm/);
  assert.match(source, /api\.auth\.mfaDisable/);
  assert.match(source, /api\.auth\.sessions\(\)/);
  assert.match(source, /api\.auth\.revokeSession\(sessionId\)/);
  assert.match(source, /api\.auth\.changePassword\(/);
  assert.match(source, /sessionsQuery\.data\.current_session_id/);
  assert.match(source, /Password updated\. Other sessions were signed out\./);
  const securityPanel = source.split('{tab==="Security" &&')[1]?.split('{tab==="Notifications" &&')[0] || "";
  assert.doesNotMatch(securityPanel, /Kerkrade, NL|Safari · iPhone|christopher@example\.com|saved in demo mode/);
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


test("workspace profile displays authenticated identity instead of placeholder account data", async () => {
  const source = await read("src/routes/_authed/dashboard.jsx");
  assert.match(source, /queryFn: \(\) => api\.auth\.me\(\)/);
  assert.match(source, /accountQuery\.data\?\.display_name/);
  assert.match(source, /<input readOnly value=\{account\?\.display_name/);
  assert.match(source, /<input readOnly value=\{account\?\.email/);
  assert.doesNotMatch(source, /name: "Christopher", email: "christopher@example\.com"/);
});


test("account security UI calls authenticated password and session endpoints", async () => {
  const client = await read("src/api/client.js");
  const backend = await read("backend/src/server.js");
  assert.match(client, /\/api\/v1\/auth\/sessions/);
  assert.match(client, /\/api\/v1\/auth\/password\/change/);
  assert.match(backend, /path === "\/api\/v1\/auth\/sessions"/);
  assert.match(backend, /path === "\/api\/v1\/auth\/password\/change"/);
  assert.match(backend, /DELETE FROM sessions WHERE id=\$1 AND user_id=\$2/);
  assert.match(backend, /verifyTotp\(secret, body\.mfa_code\)/);
  assert.match(backend, /DELETE FROM sessions WHERE user_id=\$1 AND id<>\$2/);
});

test("read-only preview does not call account MFA or password mutation endpoints", async () => {
  const source = await read("src/routes/_authed/dashboard.jsx");
  const mfa = source.split("function MfaSettings({ preview = false })")[1]?.split("\\nconst SETTINGS_DEFAULTS")[0] || "";
  assert.match(mfa, /if \(preview\) \{/);
  assert.match(mfa, /Authenticator setup is unavailable in the read-only preview/);
  assert.match(source, /<MfaSettings preview=\{preview\}\\/>/);
  const securityPanel = source.split('{tab==="Security" &&')[1]?.split('{tab==="Notifications" &&')[0] || "";
  assert.match(securityPanel, /Password changes are disabled in the read-only preview/);
  assert.match(securityPanel, /preview \? <div className="mh-callout av-settings-notice"/);
});
