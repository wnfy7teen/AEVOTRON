import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { it } from "node:test";

const readJson = async (language) => JSON.parse(await readFile(new URL(`../src/locales/${language}.json`, import.meta.url), "utf8"));

it("keeps the English, Russian and Chinese locale catalogs structurally identical", async () => {
  const [en, ru, zh] = await Promise.all(["en", "ru", "zh"].map(readJson));
  const keys = Object.keys(en).sort();
  assert.ok(keys.length >= 600, "Locale catalogs must include the migrated application vocabulary");
  assert.deepEqual(Object.keys(ru).sort(), keys, "Russian locale must contain exactly the English key set");
  assert.deepEqual(Object.keys(zh).sort(), keys, "Chinese locale must contain exactly the English key set");

  for (const [language, catalog] of Object.entries({ en, ru, zh })) {
    for (const [key, value] of Object.entries(catalog)) {
      assert.equal(typeof value, "string", `${language}.${key} must be a string`);
      assert.ok(value.trim(), `Empty ${language} translation for: ${key}`);
      assert.doesNotMatch(value.trim(), /^(?:…|\.\.\.|\[TODO\])$/, `Placeholder ${language} translation for: ${key}`);
    }
  }
});

it("includes the core workspace, billing, authentication and accessibility vocabulary", async () => {
  const [en, ru, zh] = await Promise.all(["en", "ru", "zh"].map(readJson));
  const required = [
    "Overview", "Model catalog", "API keys", "Usage & logs", "Billing", "Team & projects",
    "Add funds", "Transactions", "Transaction period", "Owner", "Admin", "Developer", "Viewer",
    "Active", "Invited", "Successful", "Errors", "Previous", "Next", "Mark all as read",
    "Welcome back", "Log in to your account", "Create your account", "Reset password",
    "Two-factor authentication", "Verify your identity", "Language", "Interface language",
    "Switch to light theme", "Switch to dark theme",
    "Previous slide", "Next slide", "More pages", "Toggle Sidebar",
    "Go to previous page", "Go to next page", "Close", "More",
  ];
  for (const key of required) {
    assert.ok(en[key], `Missing English key: ${key}`);
    assert.ok(ru[key], `Missing Russian key: ${key}`);
    assert.ok(zh[key], `Missing Chinese key: ${key}`);
  }
});

it("wires application pages and shared UI controls to react-i18next", async () => {
  const paths = [
    "../src/i18n.ts",
    "../src/lib/i18n.jsx",
    "../src/components/auth/LoginPage.jsx",
    "../src/components/auth/RegisterPage.jsx",
    "../src/components/auth/MfaFlow.jsx",
    "../src/components/auth/MfaManage.jsx",
    "../src/components/landing/AppleLanding.tsx",
    "../src/components/ui/carousel.jsx",
    "../src/components/ui/pagination.jsx",
    "../src/components/ui/sidebar.jsx",
    "../src/components/ui/dialog.jsx",
    "../src/components/ui/sheet.jsx",
    "../src/components/ui/breadcrumb.jsx",
    "../src/routes/_authed/dashboard.jsx",
  ];
  const sources = await Promise.all(paths.map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  const [config, provider, login, register, , , landing, carousel, pagination, sidebar, dialog, sheet, breadcrumb, dashboard] = sources;
  assert.match(config, /fallbackLng:\s*"en"/);
  assert.match(config, /LANGUAGE_STORAGE_KEY/);
  assert.match(config, /localStorage/);
  assert.match(provider, /I18nextProvider/);
  assert.match(login, /useTranslation/);
  assert.match(login, /t\("Welcome back"\)/);
  assert.match(register, /useTranslation/);
  assert.match(landing, /useLanguage/);
  assert.match(dashboard, /useTranslation/);
  for (const component of [carousel, pagination, sidebar, dialog, sheet, breadcrumb]) {
    assert.match(component, /useTranslation/);
    assert.match(component, /t\(/);
  }
});
