import assert from "node:assert/strict";
import test from "node:test";
import { readThemePreference, writeThemePreference } from "../src/lib/theme-preference.js";

test("theme preference defaults to gray and reads a saved dark theme", () => {
  const storage = { value: "dark", getItem(key) { assert.equal(key, "aevotron-theme"); return this.value; } };
  assert.equal(readThemePreference(null), "gray");
  assert.equal(readThemePreference(storage), "dark");
  storage.value = "unknown";
  assert.equal(readThemePreference(storage), "gray");
});

test("theme preference gracefully handles blocked browser storage", () => {
  const blocked = {
    getItem() { throw new Error("storage blocked"); },
    setItem() { throw new Error("storage blocked"); },
  };
  assert.equal(readThemePreference(blocked), "gray");
  assert.doesNotThrow(() => writeThemePreference("dark", blocked));
});

test("theme preference writes only supported themes", () => {
  const values = new Map();
  const storage = { setItem(key, value) { values.set(key, value); }, getItem(key) { return values.get(key); } };
  writeThemePreference("dark", storage);
  assert.equal(readThemePreference(storage), "dark");
  writeThemePreference("gray", storage);
  assert.equal(readThemePreference(storage), "gray");
  writeThemePreference("system", storage);
  assert.equal(readThemePreference(storage), "gray");
});
