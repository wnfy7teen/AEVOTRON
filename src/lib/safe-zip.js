const TEXT_EXTENSIONS = new Set(["txt","md","markdown","csv","tsv","json","yaml","yml","xml","html","css","js","jsx","ts","tsx","py","go","rs","java","kt","sql","sh","bash","log","toml","ini"]);
export const ZIP_LIMITS = Object.freeze({
  archiveBytes: 5 * 1024 * 1024,
  entryBytes: 512 * 1024,
  totalBytes: 2 * 1024 * 1024,
  entries: 40,
  compressionRatio: 100,
});

export function normalizeArchivePath(input) {
  if (typeof input !== "string" || !input || input.includes("\0")) throw new Error("ZIP contains an invalid file path.");
  const path = input.replaceAll("\\", "/");
  if (path.startsWith("/") || /^[a-zA-Z]:/.test(path)) throw new Error("ZIP contains an absolute file path.");
  const parts = path.split("/");
  if (parts.some((part) => part === ".." || part === ".")) throw new Error("ZIP contains a path traversal entry.");
  const normalized = parts.filter(Boolean).join("/");
  if (!normalized || normalized.length > 240) throw new Error("ZIP contains an invalid or excessively long file path.");
  return normalized;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function inflateRaw(bytes, maxOutputBytes) {
  if (typeof DecompressionStream !== "function") throw new Error("This browser does not support safe ZIP extraction. Extract the archive locally and upload its text files.");
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxOutputBytes) {
        await reader.cancel().catch(() => {});
        throw new Error("ZIP entry expands beyond its declared safe size.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return output;
}

export async function extractSafeZip(file) {
  if (!file || file.size > ZIP_LIMITS.archiveBytes) throw new Error("ZIP archive must be 5 MB or smaller.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const minEocd = Math.max(0, bytes.length - 65_557);
  let eocd = -1;
  for (let offset = bytes.length - 22; offset >= minEocd; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0 || eocd + 22 > bytes.length) throw new Error("ZIP central directory is missing or invalid.");
  if (view.getUint16(eocd + 4, true) !== 0 || view.getUint16(eocd + 6, true) !== 0) throw new Error("Multi-disk ZIP archives are not supported.");
  const entriesCount = view.getUint16(eocd + 10, true);
  const centralSize = view.getUint32(eocd + 12, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  if (entriesCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) throw new Error("ZIP64 archives are not supported.");
  if (entriesCount > ZIP_LIMITS.entries || centralOffset + centralSize > eocd || centralOffset + centralSize > bytes.length) throw new Error("ZIP contains too many entries or an invalid directory.");
  const metadata = [];
  let cursor = centralOffset;
  let totalExpanded = 0;
  for (let index = 0; index < entriesCount; index += 1) {
    if (cursor + 46 > bytes.length || view.getUint32(cursor, true) !== 0x02014b50) throw new Error("ZIP central directory entry is malformed.");
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const checksum = view.getUint32(cursor + 16, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const expandedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const externalAttributes = view.getUint32(cursor + 38, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const end = cursor + 46 + nameLength + extraLength + commentLength;
    if (end > bytes.length) throw new Error("ZIP central directory entry is truncated.");
    const rawName = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    const isDirectory = rawName.endsWith("/") || rawName.endsWith("\\");
    const path = normalizeArchivePath(rawName);
    const unixMode = externalAttributes >>> 16;
    if ((unixMode & 0xf000) === 0xa000) throw new Error("ZIP symbolic links are not allowed.");
    if (flags & 0x0001) throw new Error("Encrypted ZIP entries are not supported.");
    if (flags & 0x0040) throw new Error("Strongly encrypted ZIP entries are not supported.");
    if (![0, 8].includes(method)) throw new Error("ZIP uses an unsupported compression method.");
    if (expandedSize > ZIP_LIMITS.entryBytes) throw new Error("A ZIP file exceeds the 512 KB per-file limit.");
    if (compressedSize === 0 && expandedSize > 0 || compressedSize > 0 && expandedSize / compressedSize > ZIP_LIMITS.compressionRatio) throw new Error("ZIP compression ratio exceeds the safety limit.");
    totalExpanded += expandedSize;
    if (totalExpanded > ZIP_LIMITS.totalBytes) throw new Error("ZIP expanded content exceeds the 2 MB total limit.");
    if (localOffset + 30 > bytes.length || view.getUint32(localOffset, true) !== 0x04034b50) throw new Error("ZIP local file header is invalid.");
    metadata.push({ path, isDirectory, flags, method, checksum, compressedSize, expandedSize, localOffset, rawName });
    cursor = end;
  }
  if (cursor !== centralOffset + centralSize) throw new Error("ZIP central directory size does not match its entries.");

  const extracted = [];
  let actualExpandedTotal = 0;
  for (const entry of metadata) {
    if (entry.isDirectory) continue;
    const extension = entry.path.includes(".") ? entry.path.split(".").pop().toLowerCase() : "";
    if (!TEXT_EXTENSIONS.has(extension)) continue;
    const localFlags = view.getUint16(entry.localOffset + 6, true);
    const localMethod = view.getUint16(entry.localOffset + 8, true);
    const localNameLength = view.getUint16(entry.localOffset + 26, true);
    const localExtraLength = view.getUint16(entry.localOffset + 28, true);
    const localName = decoder.decode(bytes.subarray(entry.localOffset + 30, entry.localOffset + 30 + localNameLength));
    if (localMethod !== entry.method || localFlags !== entry.flags || (localFlags & 0x0001) || localName !== entry.rawName) throw new Error("ZIP local and central directory metadata do not match.");
    const dataStart = entry.localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + entry.compressedSize;
    if (dataEnd > centralOffset || dataEnd > bytes.length) throw new Error("ZIP entry data overlaps its directory or is truncated.");
    const compressed = bytes.subarray(dataStart, dataEnd);
    const content = entry.method === 0 ? compressed.slice() : await inflateRaw(compressed, Math.min(entry.expandedSize, ZIP_LIMITS.entryBytes));
    actualExpandedTotal += content.byteLength;
    if (actualExpandedTotal > ZIP_LIMITS.totalBytes) throw new Error("ZIP expanded content exceeds the 2 MB total limit.");
    if (content.byteLength !== entry.expandedSize || crc32(content) !== entry.checksum) throw new Error("ZIP entry failed its size or integrity check.");
    let text;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(content); }
    catch { throw new Error("ZIP contains a text file that is not valid UTF-8."); }
    const controls = [...text].filter((character) => {
      const code = character.charCodeAt(0);
      return code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31);
    }).length;
    if (controls > Math.max(2, text.length * 0.01)) throw new Error("ZIP contains a file that is not plain text.");
    extracted.push({ name: entry.path.split("/").pop(), path: entry.path, size: content.byteLength, text });
  }
  return extracted;
}
