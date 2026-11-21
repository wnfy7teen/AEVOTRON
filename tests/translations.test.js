import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { it } from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

it("keeps the English, Russian and Simplified Chinese catalogs structurally identical", async () => {
  const [en, ru, zh] = await Promise.all([
    read("src/locales/en.json").then(JSON.parse),
    read("src/locales/ru.json").then(JSON.parse),
    read("src/locales/zh.json").then(JSON.parse),
  ]);
  const keys = Object.keys(en).sort();
  assert.ok(keys.length >= 500, "The locale catalog should retain the audited application vocabulary");
  assert.deepEqual(Object.keys(ru).sort(), keys, "Russian locale keys must match English");
  assert.deepEqual(Object.keys(zh).sort(), keys, "Chinese locale keys must match English");

  for (const [locale, dictionary] of Object.entries({ en, ru, zh })) {
    for (const key of keys) {
      assert.equal(typeof dictionary[key], "string", `Missing string in ${locale}: ${key}`);
      assert.ok(dictionary[key].trim(), `Empty translation in ${locale}: ${key}`);
      assert.doesNotMatch(dictionary[key].trim(), /^(?:…|\.\.\.|\[TODO\])$/, `Placeholder in ${locale}: ${key}`);
    }
  }
});

it("configures i18next with English fallback and localStorage language persistence", async () => {
  const config = await read("src/i18n.ts");
  assert.match(config, /fallbackLng:\s*"en"/);
  assert.match(config, /order:\s*\["localStorage"\]/);
  assert.match(config, /lookupLocalStorage:\s*"aevotron-language"/);
  assert.match(config, /caches:\s*\["localStorage"\]/);
  assert.match(config, /initReactI18next/);
});
