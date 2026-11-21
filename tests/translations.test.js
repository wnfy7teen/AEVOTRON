import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { it } from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

function extractObject(source, marker) {
  const markerIndex = source.indexOf(marker);
  assert.notEqual(markerIndex, -1, `Missing translation section: ${marker}`);
  const start = source.indexOf("{", markerIndex);
  let depth = 0;
  let quote = "";
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\\\") escaped = true;
      else if (char === quote) inString = false;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      inString = true;
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Unclosed translation section: ${marker}`);
}

function parseDictionary(block) {
  return new Map(
    [...block.matchAll(/^\s{4}"((?:[^"\\\\]|\\\\.)*)":\s*"((?:[^"\\\\]|\\\\.)*)"\s*,?$/gm)]
      .map((match) => [match[1], match[2]]),
  );
}

function parseLocaleMap(block) {
  return [...block.matchAll(/^\s{2}"((?:[^"\\\\]|\\\\.)*)":\s*\{([^}]*)\},?$/gm)]
    .map((match) => {
      const locales = Object.fromEntries(
        [...match[2].matchAll(/\b(en|ru|zh):\s*"((?:[^"\\\\]|\\\\.)*)"/g)]
          .map((entry) => [entry[1], entry[2]]),
      );
      return { key: match[1], locales };
    });
}

it("should have translations in all languages", async () => {
  const source = await read("src/lib/i18n.jsx");
  const supportedMatch = source.match(/const supported = \[([^\]]+)\]/);
  assert.ok(supportedMatch, "Supported language list must exist");
  const supported = [...supportedMatch[1].matchAll(/"([a-z-]+)"/g)].map((match) => match[1]);
  assert.deepEqual([...supported].sort(), ["en", "ru", "zh"]);

  const dictionaries = extractObject(source, "const dictionaries = {");
  const ru = parseDictionary(extractObject(dictionaries, "ru: {"));
  const zh = parseDictionary(extractObject(dictionaries, "zh: {"));
  assert.ok(ru.size > 0 && zh.size > 0, "Russian and Chinese dictionaries must not be empty");

  const missingChinese = [...ru.keys()].filter((key) => !zh.has(key));
  assert.deepEqual(missingChinese, [], "Every Russian dictionary source key must have a Chinese translation");
  for (const [key, value] of [...ru, ...zh]) {
    assert.ok(value.trim(), `Empty translation for: ${key}`);
    assert.doesNotMatch(value.trim(), /^(?:…|\.\.\.|\[TODO\])$/, `Placeholder translation for: ${key}`);
  }

  const workspace = parseLocaleMap(extractObject(source, "const workspaceTranslations = {"));
  assert.ok(workspace.length > 0, "Workspace translation catalog must not be empty");
  for (const entry of workspace) {
    assert.ok(entry.locales.ru?.trim(), `Missing Russian workspace translation: ${entry.key}`);
    assert.ok(entry.locales.zh?.trim(), `Missing Chinese workspace translation: ${entry.key}`);
  }

  const landing = parseLocaleMap(extractObject(source, "const landingTranslations = {"));
  assert.ok(landing.length > 0, "Landing translation catalog must not be empty");
  for (const entry of landing) {
    assert.ok(entry.locales.en?.trim(), `Missing English landing translation: ${entry.key}`);
    assert.ok(entry.locales.zh?.trim(), `Missing Chinese landing translation: ${entry.key}`);
    if (!/[\u0400-\u04ff\u4e00-\u9fff]/u.test(entry.key)) {
      assert.ok(entry.locales.ru?.trim(), `Missing Russian landing translation: ${entry.key}`);
    }
  }
});

it("keeps all audited page labels, model descriptions and fallback screens translated", async () => {
  const source = await read("src/lib/i18n.jsx");
  const dictionaries = extractObject(source, "const dictionaries = {");
  const ru = parseDictionary(extractObject(dictionaries, "ru: {"));
  const zh = parseDictionary(extractObject(dictionaries, "zh: {"));
  const workspace = parseLocaleMap(extractObject(source, "const workspaceTranslations = {"));
  const landing = parseLocaleMap(extractObject(source, "const landingTranslations = {"));
  const keys = new Set([
    ...ru.keys(),
    ...zh.keys(),
    ...workspace.map((entry) => entry.key),
    ...landing.map((entry) => entry.key),
  ]);
  const required = [
    "Sign in required",
    "Continue to sign in",
    "QR code for authenticator app setup",
    "Email verified",
    "Verification failed",
    "Verify email",
    "Verifying your email address…",
    "This verification link is missing its code.",
    "This verification link is invalid or expired.",
    "Your email is verified. Your account is ready.",
    "Verify email — Aevotron",
    "Enter a code from your authenticator app",
    "Sign in to manage your two-factor authentication.",
    "Use an app like Google Authenticator or Duo to generate secure sign-in codes.",
    "Verify with a code sent to your phone",
    "Back to registration",
    "Access not granted",
    "Your account is not registered for this app.",
    "Ask the app owner for an invitation, or sign in with a different account.",
    "The page you are looking for does not exist.",
    "Go back",
    "Start over",
    "Try again",
    "Home",
    "Search request logs",
    "Search model, provider or error",
    "Filter request status",
    "All statuses",
    "Revoke this API key? Applications using it will lose access immediately.",
    "Could not load MFA status.",
    "Could not start authenticator setup.",
    "Two-factor authentication enabled",
    "Two-factor authentication disabled",
    "Password updated. Other sessions were signed out.",
    "Could not load active sessions.",
    "End this session? The device will need to sign in again.",
    "Billing currency",
    "Automatic top-up",
    "Webhook URL must use HTTPS",
    "Workspace is ready",
    "Your AEVOTRON workspace has been initialized.",
    "Usage summary available",
    "Your monthly usage summary is ready to review.",
    "Универсальная мультимодальная модель для сложных диалогов, анализа и работы с изображениями.",
    "Быстрая и экономичная модель для повседневных запросов, классификации и коротких ответов.",
    "Сильная модель для сложных инструкций, анализа и задач с большим контекстом.",
    "Баланс скорости и качества для прикладных задач, ассистентов и обработки текста.",
    "Лёгкая модель для простых задач с приоритетом скорости и низкой стоимости.",
    "Reasoning-модель для многошагового анализа, логики и непростых технических задач.",
    "Компактная reasoning-модель для логики, математики и программирования.",
    "Быстрая reasoning-модель для анализа, кода и задач, где важны скорость и точность.",
    "Модель с усиленным пошаговым рассуждением для сложных аналитических задач.",
    "Облегчённая модель для быстрых ответов и задач с ограниченным бюджетом.",
    "Текстовая AI-модель для диалогов, генерации и анализа контента.",
  ];
  for (const key of required) assert.ok(keys.has(key), `Missing audited translation key: ${key}`);
});

it("localizes page metadata, accessibility labels, currency and dates", async () => {
  const i18n = await read("src/lib/i18n.jsx");
  const dashboard = await read("src/routes/_authed/dashboard.jsx");
  assert.match(i18n, /document\.title/);
  assert.match(i18n, /meta\[name=description\]/);
  assert.match(i18n, /"alt"/);
  assert.match(i18n, /attributeFilter: \["aria-label", "title", "placeholder", "alt", "content"\]/);
  assert.match(i18n, /closest\("\[data-no-translate\], pre, code, script, style"\)/);
  assert.match(dashboard, /new Intl\.NumberFormat\(locale, \{ style: "currency", currency: "USD" \}\)/);
  assert.match(dashboard, /new Intl\.DateTimeFormat\(locale/);
  assert.match(dashboard, /"ru-RU"/);
  assert.match(dashboard, /"zh-CN"/);
  assert.doesNotMatch(dashboard, /Nov 18, 2026|Nov 12, 2026|Nov 04, 2026|Today · 09:42|Yesterday · 16:20/);
});
