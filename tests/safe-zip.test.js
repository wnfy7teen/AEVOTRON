import test from "node:test";
import assert from "node:assert/strict";
import { extractSafeZip, normalizeArchivePath, ZIP_LIMITS } from "../src/lib/safe-zip.js";

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function storedZip(name, text) {
  const filename = new TextEncoder().encode(name);
  const data = new TextEncoder().encode(text);
  const crc = crc32(data);
  const local = new Uint8Array(30 + filename.length + data.length);
  const lv = new DataView(local.buffer);
  lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true);
  lv.setUint32(14, crc, true); lv.setUint32(18, data.length, true); lv.setUint32(22, data.length, true);
  lv.setUint16(26, filename.length, true); local.set(filename, 30); local.set(data, 30 + filename.length);
  const central = new Uint8Array(46 + filename.length);
  const cv = new DataView(central.buffer);
  cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 0x0314, true); cv.setUint16(6, 20, true);
  cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true);
  cv.setUint16(28, filename.length, true); cv.setUint32(38, 0x81a40000, true);
  central.set(filename, 46);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, 1, true); ev.setUint16(10, 1, true);
  ev.setUint32(12, central.length, true); ev.setUint32(16, local.length, true);
  const result = new Uint8Array(local.length + central.length + eocd.length);
  result.set(local); result.set(central, local.length); result.set(eocd, local.length + central.length);
  return new File([result], "archive.zip", { type: "application/zip" });
}

test("ZIP path validation rejects traversal and absolute paths", () => {
  for (const path of ["../secret.txt", "folder/../../secret", "/etc/passwd", "C:\\Windows\\win.ini", "./notes.txt"]) {
    assert.throws(() => normalizeArchivePath(path));
  }
});

test("ZIP path validation normalizes safe nested paths", () => {
  assert.equal(normalizeArchivePath("src/components/App.tsx"), "src/components/App.tsx");
  assert.equal(normalizeArchivePath("src\\components\\App.tsx"), "src/components/App.tsx");
});

test("safe ZIP extraction verifies stored text files and preserves their folder path", async () => {
  const files = await extractSafeZip(storedZip("src/components/App.tsx", "export const answer = 42;"));
  assert.equal(files.length, 1);
  assert.equal(files[0].path, "src/components/App.tsx");
  assert.equal(files[0].text, "export const answer = 42;");
});

test("safe ZIP extraction rejects path traversal before reading entry content", async () => {
  await assert.rejects(() => extractSafeZip(storedZip("../outside.txt", "nope")), /path traversal/i);
});

test("ZIP extraction limits are conservative and explicit", () => {
  assert.equal(ZIP_LIMITS.archiveBytes, 5 * 1024 * 1024);
  assert.equal(ZIP_LIMITS.entryBytes, 512 * 1024);
  assert.equal(ZIP_LIMITS.totalBytes, 2 * 1024 * 1024);
  assert.equal(ZIP_LIMITS.entries, 40);
  assert.equal(ZIP_LIMITS.compressionRatio, 100);
});
