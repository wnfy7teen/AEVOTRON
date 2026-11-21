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
  ];
  for (const key of required) {
    assert.ok(en[key], `Missing English key: ${key}`);
    assert.ok(ru[key], `Missing Russian key: ${key}`);
    assert.ok(zh[key], `Missing Chinese key: ${key}`);
  }
});

it("keeps React screens wired to react-i18next rather than the legacy dictionary implementation", async () => {
  const [provider, login, register, dashboard, landing] = await Promise.all([
    readFile(new URL("../src/lib/i18n.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/auth/LoginPage.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/auth/RegisterPage.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/_authed/dashboard.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/landing/AppleLanding.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(provider, /I18nextProvider/);
  assert.match(login, /useTranslation/);
  assert.match(login, /t\("Welcome back"\)/);
  assert.match(register, /useTranslation/);
  assert.match(dashboard, /useLanguage/);
  assert.match(landing, /useLanguage/);
});
