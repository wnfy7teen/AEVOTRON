import test from "node:test";
import assert from "node:assert/strict";
import { normalizeArchivePath, ZIP_LIMITS } from "../src/lib/safe-zip.js";

test("ZIP path validation rejects traversal and absolute paths", () => {
  for (const path of ["../secret.txt", "folder/../../secret", "/etc/passwd", "C:\\Windows\\win.ini", "./notes.txt"]) {
    assert.throws(() => normalizeArchivePath(path));
  }
});

test("ZIP path validation normalizes safe nested paths", () => {
  assert.equal(normalizeArchivePath("src/components/App.tsx"), "src/components/App.tsx");
  assert.equal(normalizeArchivePath("src\\components\\App.tsx"), "src/components/App.tsx");
});

test("ZIP extraction limits are conservative and explicit", () => {
  assert.equal(ZIP_LIMITS.archiveBytes, 5 * 1024 * 1024);
  assert.equal(ZIP_LIMITS.entryBytes, 512 * 1024);
  assert.equal(ZIP_LIMITS.totalBytes, 2 * 1024 * 1024);
  assert.equal(ZIP_LIMITS.entries, 40);
  assert.equal(ZIP_LIMITS.compressionRatio, 100);
});
