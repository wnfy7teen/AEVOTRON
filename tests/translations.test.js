import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { it } from "node:test";

const readJson = async (language) => JSON.parse(await readFile(new URL(`../src/locales/${language}.json`, import.meta.url), "utf8"));

it("keeps the English, Russian and Chinese locale catalogs structurally identical", async () => {
  const [en, ru, zh] = await Promise.all(["en", "ru", "zh"].map(readJson));
  const keys = Object.keys(en).sort();
  assert.ok(keys.length >= 760, "Locale catalogs must include the complete application vocabulary and plural forms");
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


it("keeps model descriptions translated and validates locale punctuation", async () => {
  const [en, ru, zh] = await Promise.all(["en", "ru", "zh"].map((language) => readFile(new URL(`../src/locales/dashboard/${language}.json`, import.meta.url), "utf8").then(JSON.parse)));
  const modelKeys = [
    "model.description.gpt4o", "model.description.gpt4oMini", "model.description.gpt41",
    "model.description.gpt41Mini", "model.description.gpt41Nano", "model.description.o3",
    "model.description.o3Mini", "model.description.o4Mini", "model.description.reasoning",
    "model.description.lightweight", "model.description.default",
  ];
  for (const key of modelKeys) {
    assert.ok(en[key], `Missing English model description: ${key}`);
    assert.ok(ru[key], `Missing Russian model description: ${key}`);
    assert.ok(zh[key], `Missing Chinese model description: ${key}`);
  }
  for (const [key, value] of Object.entries(ru)) {
    assert.ok(!value.includes("。"), `Chinese full stop found in Russian translation: ${key}`);
  }
  for (const [key, value] of Object.entries(zh)) {
    assert.ok(!value.includes("..."), `ASCII ellipsis found in Chinese translation: ${key}`);
  }
  const rootCatalogs = await Promise.all(["en", "ru", "zh"].map(readJson));
  for (const language of rootCatalogs) {
    for (const form of ["one", "few", "many", "other"]) {
      assert.ok(language[`i18n.test.item_${form}`], `Missing plural form: ${form}`);
    }
  }
});

it("uses request-scoped locale resolution and does not mutate the DOM with an observer", async () => {
  const [config, provider, root, serverLocale, dashboard] = await Promise.all([
    readFile(new URL("../src/i18n.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/i18n.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/__root.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/i18n.functions.js", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/_authed/dashboard.jsx", import.meta.url), "utf8"),
  ]);
  assert.match(config, /createInstance\(/);
  assert.match(config, /fallbackNS: "translation"/);
  assert.match(config, /locales\/dashboard/);
  assert.doesNotMatch(config, /new MutationObserver/);
  assert.match(provider, /initialLanguage/);
  assert.match(provider, /persistLanguageCookie/);
  assert.match(root, /getRequestLocale/);
  assert.match(root, /<html lang=/);
  assert.match(serverLocale, /getRequestHeader\("cookie"\)/);
  assert.match(serverLocale, /accept-language/);
  assert.doesNotMatch(dashboard, /Модель с усиленным пошаговым рассуждением/);
  assert.match(dashboard, /useTranslation\(\["dashboard", "translation"\]\)/);
  assert.match(dashboard, /t\(describeModel\(model.id\)\)/);
});

it("formats numbers, currencies, dates and relative time using the active locale", async () => {
  const {
    formatNumber,
    formatCurrency,
    formatDate,
    formatRelativeTime,
    getIntlLocale,
  } = await import("../src/lib/formatters.js");
  assert.equal(getIntlLocale("ru-RU"), "ru-RU");
  assert.equal(getIntlLocale("zh-CN"), "zh-CN");
  assert.equal(getIntlLocale("unsupported"), "en-US");
  assert.match(formatNumber(1234.5, "ru"), /1.234,5|1\\u00a0234,5|1\\u202f234,5/);
  assert.match(formatCurrency(12.5, "EUR", "en"), /€|EUR/);
  assert.ok(formatDate("2026-01-02T12:00:00.000Z", "zh").length > 0);
  assert.ok(formatRelativeTime(-1, "day", "ru").length > 0);
  assert.equal(formatDate("not-a-date", "en"), "");
});

it("resolves locale from cookie before weighted Accept-Language preferences", async () => {
  const { readLocaleCookie, negotiateAcceptLanguage, resolveRequestLocale } = await import("../src/lib/locale.js");
  assert.equal(readLocaleCookie("theme=dark; aevotron-language=ru%2DRU"), "ru-RU");
  assert.equal(readLocaleCookie("theme=dark"), null);
  assert.equal(negotiateAcceptLanguage("fr-FR, zh-CN;q=0.8, ru-RU;q=0.9"), "ru");
  assert.equal(negotiateAcceptLanguage("fr-FR, zh-CN;q=0.9, en-US;q=0.8"), "zh");
  assert.equal(resolveRequestLocale("aevotron-language=zh", "ru-RU,ru;q=0.9"), "zh");
  assert.equal(resolveRequestLocale("aevotron-language=fr", "ru-RU,ru;q=0.9"), "ru");
  assert.equal(resolveRequestLocale("", "fr-FR, de-DE;q=0.8"), "en");
});

it("keeps domain namespace catalogs aligned across supported locales", async () => {
  for (const namespace of ["dashboard", "landing", "auth"]) {
    const catalogs = await Promise.all(["en", "ru", "zh"].map((language) =>
      readFile(new URL(`../src/locales/${namespace}/${language}.json`, import.meta.url), "utf8").then(JSON.parse)
    ));
    const keys = Object.keys(catalogs[0]).sort();
    assert.ok(keys.length > 0, `${namespace} namespace must not be empty`);
    assert.deepEqual(Object.keys(catalogs[1]).sort(), keys, `${namespace} Russian keys must match English`);
    assert.deepEqual(Object.keys(catalogs[2]).sort(), keys, `${namespace} Chinese keys must match English`);
    for (const [index, catalog] of catalogs.entries()) {
      for (const [key, value] of Object.entries(catalog)) {
        assert.equal(typeof value, "string", `${namespace} locale ${index} key ${key} must be a string`);
        assert.ok(value.trim(), `${namespace} locale ${index} key ${key} must not be empty`);
      }
    }
  }
});

it("migrates landing and authentication UI to domain namespaces with legacy fallback", async () => {
  const [config, landing, login, register, verification] = await Promise.all([
    readFile(new URL("../src/i18n.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/components/landing/AppleLanding.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/auth/LoginPage.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/auth/RegisterPage.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/verify-email.jsx", import.meta.url), "utf8"),
  ]);
  assert.match(config, /landing: landingEn/);
  assert.match(config, /auth: authEn/);
  assert.match(config, /fallbackNS: "translation"/);
  assert.match(landing, /useLanguage\(\["landing", "translation"\]\)/);
  assert.match(login, /useTranslation\(\["auth", "translation"\]\)/);
  assert.match(register, /useTranslation\(\["auth", "translation"\]\)/);
  assert.match(verification, /useTranslation\(\["auth", "translation"\]\)/);
});
