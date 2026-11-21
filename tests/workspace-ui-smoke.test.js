import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
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
  assert.ok(source.includes("<MfaSettings preview={preview}/>"));
  const securityPanel = source.split('{tab==="Security" &&')[1]?.split('{tab==="Notifications" &&')[0] || "";
  assert.match(securityPanel, /Password changes are disabled in the read-only preview/);
  assert.match(securityPanel, /preview \? <div className="mh-callout av-settings-notice"/);
});


test("global theme and language controls follow the selected light or dark theme", async () => {
  const theme = await read("src/lib/ThemeSwitcher.jsx");
  const css = await read("src/apple-style.css");
  assert.match(theme, /document\.documentElement\.dataset\.theme = theme/);
  assert.match(theme, /element\.dataset\.theme = theme/);
  assert.match(css, /html\[data-theme="dark"\] \.av-theme-trigger/);
  assert.match(css, /html\[data-theme="dark"\] \.av-language-trigger/);
  assert.match(css, /html\[data-theme="dark"\] \.av-language-menu/);
  assert.match(css, /html\[data-theme="dark"\] \.av-language-menu button\.active/);
});

test("workspace interaction polish covers keyboard focus, disabled controls and reduced motion", async () => {
  const css = await read("src/apple-style.css");
  assert.match(css, /:focus-visible/);
  assert.match(css, /:disabled/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /\.apple-app\[data-theme="dark"\] \.av-notification-row\.is-read/);
  assert.match(css, /@media \(max-width: 560px\)/);
});

 
test("workspace dropdown menus share responsive light and dark styling", async () => {
  const css = await read("src/apple-style.css");
  assert.match(css, /\.av-dropdown-trigger/);
  assert.doesNotMatch(css, /\.mh-toolbar select/);
  assert.match(css, /\.av-dropdown-menu/);
  assert.match(css, /\.av-dropdown-option\.is-selected/);
  assert.match(css, /data-theme="dark"\] \.av-dropdown-menu/);
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*?\.av-dropdown-trigger/);
});


test("popular model list has explicit readable layout and contrast in light and dark themes", async () => {
  const css = await read("src/apple-style.css");
  const dashboard = await read("src/routes/_authed/dashboard.jsx");
  assert.match(dashboard, /<h3>Popular models<\/h3>/);
  assert.match(dashboard, /className="mh-popular-row"/);
  assert.match(css, /\.mh-bottom-grid > \.mh-panel:first-child \.mh-popular-row \{/);
  assert.match(css, /grid-template-columns: 9px minmax\(0, 1fr\) auto 16px/);
  assert.match(css, /\.mh-popular-row strong \{[\s\S]*?color: #17212d/);
  assert.match(css, /\.mh-popular-row \.mh-model-description \{[\s\S]*?color: #596879/);
  assert.match(css, /data-theme="dark"\] \.mh-bottom-grid > \.mh-panel:first-child \.mh-popular-row strong/);
  assert.match(css, /data-theme="dark"\] \.mh-bottom-grid > \.mh-panel:first-child \.mh-popular-row \.mh-model-description/);
});

test("dashboard buttons and forms have explicit actions and native validation", async () => {
  const source = await read("src/routes/_authed/dashboard.jsx");
  const buttons = [...source.matchAll(/<button\b[\s\S]*?>/g)].map(([tag]) => tag);
  assert.ok(buttons.length >= 35, "Expected the workspace action buttons to be present");
  for (const [index, tag] of buttons.entries()) {
    assert.ok(/\bonClick\s*=/.test(tag) || /\btype\s*=\s*["']submit["']/.test(tag) || /\bdisabled(?:\s|=|>)/.test(tag),
      `Button ${index + 1} must have an action, submit a form, or be explicitly disabled`);
  }
  const forms = [...source.matchAll(/<form\b[\s\S]*?>/g)].map(([tag]) => tag);
  assert.ok(forms.length >= 6, "Expected the account forms to be present");
  for (const [index, tag] of forms.entries()) {
    assert.ok(/\bonSubmit\s*=/.test(tag), `Form ${index + 1} must handle submission`);
  }
  assert.match(source, /id="openai-key-help"/);
  assert.match(source, /Teammate email address/);
  assert.match(source, /already in the workspace/);
  assert.match(source, /minLength=\{1\} required autoComplete="off"/);
  assert.match(source, /pattern="\[0-9\]\{6\}" required/);
});

test("ESLint includes the shared UI component library in its source audit", async () => {
  const config = await read("eslint.config.js");
  assert.doesNotMatch(config, /src\/components\/ui\/\*\*/);
  assert.match(config, /files: \["\*\*\/\*\.\{js,jsx\}"\]/);
});

test("API key expiry dropdown renders above the existing-keys panel", async () => {
  const css = await read("src/apple-style.css");
  const dashboard = await read("src/routes/_authed/dashboard.jsx");
  assert.match(dashboard, /className="mh-panel mh-key-create"/);
  assert.match(dashboard, /className="mh-panel mh-key-list-panel"/);
  assert.match(dashboard, /className="mh-key-form-expiry"/);
  assert.match(css, /\.mh-key-create \{[\s\S]*?position: relative;[\s\S]*?z-index: 5;[\s\S]*?overflow: visible;/);
  assert.match(css, /\.mh-key-create \.av-dropdown\[data-open="true"\] \{[\s\S]*?z-index: 20;/);
  assert.match(css, /\.mh-key-list-panel \{[\s\S]*?z-index: 1;/);
});



test("workspace footer is pinned to the bottom across short and long routes", async () => {
  const css = await read("src/apple-style.css");
  const dashboard = await read("src/routes/_authed/dashboard.jsx");
  assert.match(dashboard, /<main className="mh-main">[\s\S]*?<div className="mh-content">[\s\S]*?<footer className="mh-footer">/);
  assert.match(css, /\.mh-main \{[\s\S]*?display: grid;[\s\S]*?grid-template-rows: auto minmax\(0, 1fr\) auto;[\s\S]*?min-height: 100dvh;/);
  assert.match(css, /\.mh-content \{[\s\S]*?align-self: stretch;/);
  assert.match(css, /\.mh-footer \{[\s\S]*?align-self: end;[\s\S]*?width: 100%;/);
});


test("Sonner success and error notifications remain readable above the workspace in both themes", async () => {
  const toaster = await read("src/components/ui/sonner.jsx");
  const css = await read("src/apple-style.css");
  assert.match(toaster, /position="top-right"/);
  assert.match(toaster, /aevotron-toaster/);
  assert.match(toaster, /title: "aevotron-toast-title"/);
  assert.match(css, /\[data-sonner-toaster\]\.aevotron-toaster/);
  assert.match(css, /\[data-sonner-toast\] \[data-title\][\s\S]*?color: #17212d !important/);
  assert.match(css, /html\[data-theme="dark"\] \[data-sonner-toaster\]\.aevotron-toaster/);
  assert.match(css, /color: #f1f5fa !important/);
  assert.match(css, /z-index: 10050 !important/);
});
