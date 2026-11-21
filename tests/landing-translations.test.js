import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("all static landing copy has English and Chinese translations", async () => {
  const landing = await read("src/components/landing/AppleLanding.tsx");
  const i18n = await read("src/lib/i18n.jsx");
  const start = i18n.indexOf("const landingTranslations = {");
  const end = i18n.indexOf("\n};", start);
  assert.notEqual(start, -1, "landing translation map must exist");
  assert.notEqual(end, -1, "landing translation map must be closed");
  const map = i18n.slice(start, end);

  const textNodes = [...landing.matchAll(/>([^<>]+)</g)]
    .map((match) => match[1].replace(/\s+/g, " ").trim())
    .filter((value) => /[А-Яа-яЁё]/.test(value) && !value.includes("{t("));
  const translatedCalls = [...landing.matchAll(/\bt\("([^"]+)"\)/g)]
    .map((match) => match[1]);
  const visibleCopy = [...new Set([...textNodes, ...translatedCalls])];
  const missing = [];

  for (const value of visibleCopy) {
    const marker = `${JSON.stringify(value)}:`;
    const index = map.indexOf(marker);
    if (index < 0) {
      missing.push(`${value} (missing key)`);
      continue;
    }
    const lineEnd = map.indexOf("\n", index);
    const entry = map.slice(index, lineEnd < 0 ? map.length : lineEnd);
    if (!/\ben:/.test(entry) || !/\bzh:/.test(entry)) {
      missing.push(`${value} (missing en/zh translation)`);
    }
  }

  assert.deepEqual(missing, [], "every visible landing string must be translated");
  assert.match(i18n, /const supported = \["en", "ru", "zh"\]/);
  assert.match(i18n, /new MutationObserver/);
  assert.match(i18n, /applyTranslations\\(language\\)/);
});
