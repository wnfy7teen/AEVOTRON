import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("workspace markdown renderer is split into an on-demand browser chunk", async () => {
  const source = await read("src/routes/_authed/workspace.jsx");
  assert.match(source, /const ReactMarkdown = lazy\(\(\) => import\("react-markdown"\)\)/);
  assert.match(source, /function MarkdownMessage\(\{ content \}\)/);
  assert.match(source, /<Suspense fallback=\{<span aria-label="Loading formatted message" \/>\}>/);
  assert.equal((source.match(/<MarkdownMessage content=/g) || []).length, 2);
  assert.doesNotMatch(source, /^import ReactMarkdown from "react-markdown";/m);
});

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
  assert.match(client, /"\/api\/v1\/providers\/" \+ providerCode/);
});


test("workspace profile displays authenticated identity instead of placeholder account data", async () => {
  const source = await read("src/routes/_authed/dashboard.jsx");
  assert.match(source, /queryFn: \(\) => readDemoUser\(\) \|\| api\.auth\.me\(\)/);
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
  assert.match(css, /html\[data-theme="gray"\] \.av-theme-trigger/);
  assert.match(css, /html\[data-theme="gray"\] \.av-language-trigger/);
  assert.match(css, /html\[data-theme="gray"\] \.av-language-menu/);
  assert.match(css, /html\[data-theme="gray"\] \.av-language-menu button\.active/);
});

test("workspace interaction polish covers keyboard focus, disabled controls and reduced motion", async () => {
  const css = await read("src/apple-style.css");
  assert.match(css, /:focus-visible/);
  assert.match(css, /:disabled/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /\.apple-app\[data-theme="gray"\] \.av-notification-row\.is-read/);
  assert.match(css, /@media \(max-width: 560px\)/);
});

 
test("workspace dropdown menus share responsive light and dark styling", async () => {
  const css = await read("src/apple-style.css");
  assert.match(css, /\.av-dropdown-trigger/);
  assert.doesNotMatch(css, /\.mh-toolbar select/);
  assert.match(css, /\.av-dropdown-menu/);
  assert.match(css, /\.av-dropdown-option\.is-selected/);
  assert.match(css, /data-theme="gray"\] \.av-dropdown-menu/);
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*?\.av-dropdown-trigger/);
});


test("popular model list has explicit readable layout and contrast in light and dark themes", async () => {
  const css = await read("src/apple-style.css");
  const dashboard = await read("src/routes/_authed/dashboard.jsx");
  assert.match(dashboard, /<h3>\{t\("Popular models"\)\}<\/h3>/);
  assert.match(dashboard, /className="mh-popular-row"/);
  assert.match(css, /\.mh-bottom-grid > \.mh-panel:first-child \.mh-popular-row \{/);
  assert.match(css, /grid-template-columns: 9px minmax\(0, 1fr\) auto 16px/);
  assert.match(css, /\.mh-popular-row strong \{[\s\S]*?color:\s*var\(--palette-hex-17212d\)/);
  assert.match(css, /\.mh-popular-row \.mh-model-description \{[\s\S]*?color:\s*var\(--palette-hex-596879\)/);
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
  assert.match(source, /provider\.code === "openai" \? "openai-key-help" : provider\.code \+ "-key-help"/);
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
  assert.match(css, /\.mh-main \{[\s\S]*?display:flex;[\s\S]*?flex-direction:column;[\s\S]*?margin-left:0;/);
  assert.match(css, /\.mh-content \{[\s\S]*?flex:1 0 auto;[\s\S]*?min-height:auto;/);
  assert.match(css, /\.mh-footer \{[\s\S]*?margin-top:auto;[\s\S]*?width:100%;/);
});


test("Sonner success and error notifications remain readable above the workspace in both themes", async () => {
  const toaster = await read("src/components/ui/sonner.jsx");
  const css = await read("src/apple-style.css");
  assert.match(toaster, /position="top-right"/);
  assert.match(toaster, /aevotron-toaster/);
  assert.match(toaster, /title: "aevotron-toast-title"/);
  assert.match(css, /\[data-sonner-toaster\]\.aevotron-toaster/);
  assert.match(css, /\[data-sonner-toast\] \[data-title\][\s\S]*?color:\s*var\(--palette-hex-17212d\) !important/);
  assert.match(css, /html\[data-theme="gray"\] \[data-sonner-toaster\]\.aevotron-toaster/);
  assert.match(css, /color:\s*var\(--palette-hex-f1f5fa\) !important/);
  assert.match(css, /z-index: 10050 !important/);
});


test("workspace topbar keeps menu, breadcrumb and actions aligned without overflow", async () => {
  const css = await read("src/apple-style.css");
  const dashboard = await read("src/routes/_authed/dashboard.jsx");
  assert.match(dashboard, /<main className="mh-main">[\s\S]*?<header className="mh-topbar">[\s\S]*?className="mh-breadcrumb"[\s\S]*?className="mh-top-actions"/);
  assert.match(css, /\.mh-topbar\s*\{[^}]*display:flex;[^}]*align-items:center;[^}]*justify-content:space-between;/);
  assert.match(css, /\.mh-top-actions\s*\{[^}]*display:flex;[^}]*align-items:center;/);
  assert.match(css, /@media\(max-width:760px\)[\s\S]*?\.mh-mobile-menu\{display:flex\}[\s\S]*?\.mh-breadcrumb\{flex:1;min-width:0\}/);
});

test("workspace sidebar has stable desktop geometry and a working mobile drawer", async () => {
  const css = await read("src/apple-style.css");
  const dashboard = await read("src/routes/_authed/dashboard.jsx");
  assert.match(dashboard, /mh-sidebar-open/);
  assert.match(css, /\.mh-shell \{[^}]*display:flex;[^}]*align-items:stretch;/);
  assert.match(css, /\.mh-sidebar \{[^}]*position:sticky;[^}]*flex:0 0 252px;[^}]*height:100dvh;/);
  assert.match(css, /\.mh-main \{[^}]*margin-left:0;/);
  assert.match(css, /@media \(max-width:760px\)[\s\S]*?\.mh-sidebar \{[^}]*position:fixed;[^}]*transform:translateX\(-105%\);[\s\S]*?\.mh-sidebar\.mh-sidebar-open \{[^}]*transform:translateX\(0\);/);
});


test("dashboard footer has readable text and a distinct status indicator in the gray theme", async () => {
  const css = await read("src/apple-style.css");
  const theme = await read("src/lib/ThemeSwitcher.jsx");
  const root = await read("src/routes/__root.jsx");
  assert.match(root, /className="apple-app app-route-transition"/);
  assert.match(theme, /document\.documentElement\.dataset\.theme = theme/);
  assert.match(theme, /element\.dataset\.theme = theme/);
  assert.match(css, /html\[data-theme="gray"\] \.apple-app \.mh-footer\s*\{[^}]*color:\s*var\(--palette-hex-c2c2c7\)/);
  assert.match(css, /html\[data-theme="gray"\] \.apple-app \.mh-footer > span:first-child[\s\S]*?color:\s*var\(--palette-hex-a1a1a6\)/);
  assert.match(css, /html\[data-theme="gray"\] \.apple-app \.mh-footer-dot\s*\{[^}]*background:\s*var\(--palette-hex-34c759\)/);
  assert.match(css, /html\[data-theme="gray"\] \.apple-app \.mh-footer-sep\s*\{[^}]*color:\s*var\(--palette-hex-636366\)/);
});


test("read-only workspace preview never mounts live provider, API key or usage pages", async () => {
  const source = await read("src/routes/_authed/dashboard.jsx");
  assert.match(source, /section === "Providers" && \(preview \? <PreviewReadOnlySection title=\{t\("Provider connections"\)\}\/> : <ProviderConnections\/>\)/);
  assert.match(source, /section === "API keys" && \(preview \? <PreviewReadOnlySection title=\{t\("API keys"\)\}\/> : <ApiKeyManager\/>\)/);
  assert.match(source, /section === "Usage & logs" && \(preview \? <PreviewReadOnlySection title=\{t\("Usage & logs"\)\}\/> : <UsageDashboard\/>\)/);
  assert.match(source, /function PreviewReadOnlySection\(\{ title \}\)/);
  assert.match(source, /Sample data · Read-only mode · No account or backend connection required/);
  assert.match(source, /disabled=\{preview && item\.name === "AI Workspace"\}/);
  assert.match(source, /onClick=\{\(\) => modelQuery\.refetch\(\)\} disabled=\{preview \|\| modelQuery\.isFetching\}/);
});

test("Cloudflare Workers preview redirects every authenticated route to the isolated public preview", async () => {
  const auth = await read("src/lib/AuthContext.jsx");
  const gate = await read("src/components/auth/AuthGate.jsx");
  assert.match(auth, /export function isCloudflareWorkersPreview\(\)/);
  assert.match(auth, /hostname\.includes\("preview"\) && hostname\.endsWith\("\.workers\.dev"\)/);
  assert.match(auth, /\|\| isCloudflareWorkersPreview\(\)/);
  assert.match(gate, /import \{ authQuery, isCloudflareWorkersPreview \} from "@\/lib\/AuthContext"/);
  assert.match(gate, /if \(isCloudflareWorkersPreview\(\)\)\s*\{\s*throw redirect\(\{ to: "\/workspace-preview", reloadDocument: true \}\);/);
  const authedRoute = await read("src/routes/_authed.jsx");
  const previewRoute = await read("src/routes/workspace-preview.jsx");
  assert.match(authedRoute, /beforeLoad: requireSignedIn/);
  assert.match(authedRoute, /ssr: false/);
  assert.match(previewRoute, /createFileRoute\("\/workspace-preview"\)/);
  assert.doesNotMatch(previewRoute, /requireSignedIn|AuthGate/);
});

test("public workspace preview lazy-loads the dashboard module behind a Suspense boundary", async () => {
  const previewRoute = await read("src/routes/workspace-preview.jsx");
  assert.match(previewRoute, /const PreviewDashboard = lazy\(\(\) =>\s*import\("\.\/_authed\/dashboard"\)/);
  assert.match(previewRoute, /<Suspense fallback=\{<div role="status" aria-label="Loading workspace preview" \/>\}>/);
  assert.match(previewRoute, /<PreviewDashboard \/>/);
  assert.doesNotMatch(previewRoute, /import \{ PreviewDashboard \} from "\.\/_authed\/dashboard"/);
});

test("preview banner describes interactive local demo behavior accurately in all locales", async () => {
  const dashboard = await read("src/routes/_authed/dashboard.jsx");
  assert.match(dashboard, /Sample data · Interactive demo · Local changes only · No account or backend connection required/);
  assert.match(dashboard, /name: "Demo workspace"/);
  for (const locale of ["en", "ru", "zh"]) {
    const translations = JSON.parse(await read("src/locales/" + locale + ".json"));
    assert.ok(translations["Sample data · Interactive demo · Local changes only · No account or backend connection required"], "Missing preview banner translation: " + locale);
  }
});

test("public preview dashboard disables all account and provider summary queries", async () => {
  const dashboard = await read("src/routes/_authed/dashboard.jsx");
  assert.match(dashboard, /export function PreviewDashboard\(\)\s*\{\s*return <HomePage preview \/>/);
  for (const queryKey of ["workspace-account-profile", "usage-summary", "provider-models"]) {
    const query = dashboard.split('queryKey: ["' + queryKey + '"]')[1]?.split("});")[0] || "";
    assert.match(query, /enabled: !preview/, "Preview must disable query: " + queryKey);
  }
  assert.match(dashboard, /enabled: !preview && tab === "Security"/);
  assert.match(dashboard, /if \(preview\) \{\s*setLoading\(false\);\s*return undefined;/);
});

test("MFA method setup is lazy-loaded only when enrollment or factor management opens it", async () => {
  const flow = await read("src/components/auth/MfaFlow.jsx");
  const manage = await read("src/components/auth/MfaManage.jsx");
  for (const source of [flow, manage]) {
    assert.match(source, /const MfaMethodSetup = lazy\(\(\) => import\("@\/components\/auth\/MfaMethodSetup"\)/);
    assert.match(source, /<Suspense fallback=\{<Loader2/);
    assert.doesNotMatch(source, /import \{ MfaMethodSetup \} from/);
  }
});
