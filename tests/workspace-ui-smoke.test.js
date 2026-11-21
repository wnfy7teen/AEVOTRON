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


test("AI model catalog provides concise descriptions for known and unknown models", async () => {
  const source = await read("src/routes/_authed/dashboard.jsx");
  assert.match(source, /function describeModel\(id\)/);
  assert.match(source, /"gpt-4o-mini": "Быстрая и экономичная модель/);
  assert.match(source, /"o3-mini": "Компактная reasoning-модель/);
  assert.match(source, /description: describeModel\(model\.id\)/);
  assert.match(source, /className="mh-model-description"/);
  assert.match(source, /className="mh-model-description-detail"/);
});

test("workspace uses accessible custom dropdowns instead of native select popups", async () => {
  const dashboard = await read("src/routes/_authed/dashboard.jsx");
  const component = await read("src/components/ui/Dropdown.jsx");
  const css = await read("src/apple-style.css");
  assert.doesNotMatch(dashboard, /<select\b/);
  assert.match(dashboard, /<Dropdown/);
  assert.match(component, /aria-haspopup="listbox"/);
  assert.match(component, /role="listbox"/);
  assert.match(component, /role="option"/);
  assert.match(component, /ArrowDown/);
  assert.match(component, /Home/);
  assert.match(component, /Escape/);
  assert.match(component, /pointerdown/);
  assert.match(component, /typeaheadRef/);
  assert.match(component, /toLocaleLowerCase/);
  assert.match(component, /event.key === "Enter"/);
  assert.match(css, /\.av-dropdown-menu/);
  assert.match(css, /data-theme="dark"\] \.av-dropdown-menu/);
});

test("all application routes and components avoid native select popups", async () => {
  const collect = async (directory) => {
    const entries = await readdir(new URL("../" + directory, import.meta.url), { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const relative = directory + "/" + entry.name;
      if (entry.isDirectory()) files.push(...await collect(relative));
      else if (/\.(jsx|tsx)$/.test(entry.name)) files.push(relative);
    }
    return files;
  };
  const files = await collect("src");
  const nativeSelects = [];
  for (const file of files) {
    const source = await read(file);
    if (/<select(?:\s|>)/.test(source)) nativeSelects.push(file);
  }
  assert.deepEqual(nativeSelects, [], `Native select controls remain in: ${nativeSelects.join(", ")}`);
});

  const source = await read("src/routes/_authed/dashboard.jsx");
  assert.match(source, /function describeModel\(id\)/);
  assert.match(source, /"gpt-4o-mini": "Быстрая и экономичная модель/);
  assert.match(source, /"o3-mini": "Компактная reasoning-модель/);
  assert.match(source, /description: describeModel\(model\.id\)/);
  assert.match(source, /className="mh-model-description"/);
  assert.match(source, /className="mh-model-description-detail"/);
});

test("workspace uses accessible custom dropdowns instead of native select popups", async () => {
  const dashboard = await read("src/routes/_authed/dashboard.jsx");
  const component = await read("src/components/ui/Dropdown.jsx");
  const css = await read("src/apple-style.css");
  assert.doesNotMatch(dashboard, /<select\b/);
  assert.match(dashboard, /<Dropdown/);
  assert.match(component, /aria-haspopup="listbox"/);
  assert.match(component, /role="listbox"/);
  assert.match(component, /role="option"/);
  assert.match(component, /ArrowDown/);
  assert.match(component, /Home/);
  assert.match(component, /Escape/);
  assert.match(component, /pointerdown/);
  assert.match(component, /typeaheadRef/);
  assert.match(component, /toLocaleLowerCase/);
  assert.match(component, /event.key === "Enter"/);
  assert.match(css, /\.av-dropdown-menu/);
  assert.match(css, /data-theme="dark"\] \.av-dropdown-menu/);
});

test("all application routes and components avoid native select popups", async () => {
  const collect = async (directory) => {
    const entries = await readdir(new URL("../" + directory, import.meta.url), { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const relative = directory + "/" + entry.name;
      if (entry.isDirectory()) files.push(...await collect(relative));
      else if (/\.(jsx|tsx)$/.test(entry.name)) files.push(relative);
    }
    return files;
  };
  const files = await collect("src");
  const nativeSelects = [];
  for (const file of files) {
    const source = await read(file);
    if (/<select(?:\s|>)/.test(source)) nativeSelects.push(file);
  }
  assert.deepEqual(nativeSelects, [], `Native select controls remain in: ${nativeSelects.join(", ")}`);
});
