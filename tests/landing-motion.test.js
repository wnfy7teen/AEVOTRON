import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("landing typing previews respect reduced-motion preferences", async () => {
  const landing = await read("src/components/landing/AppleLanding.tsx");
  const codeStart = landing.indexOf('const codeExample = document.querySelector(".av-site .av-code")');
  const controlStart = landing.indexOf('const controlExample = document.querySelector(".av-site .av-control")');
  assert.notEqual(codeStart, -1, "code preview effect must exist");
  assert.notEqual(controlStart, -1, "control preview effect must exist");
  const codeEffect = landing.slice(codeStart, controlStart);
  const controlEffect = landing.slice(controlStart);
  assert.match(codeEffect, /prefers-reduced-motion: reduce/);
  assert.match(codeEffect, /av-code-result.*is-typed/s);
  assert.match(controlEffect, /prefers-reduced-motion: reduce/);
});
