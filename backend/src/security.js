import {
  createCipheriv, createDecipheriv, createHash, createHmac, randomBytes,
  scrypt as scryptCallback, timingSafeEqual, createHash as hash,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const encoder = new TextEncoder();

export const sha256 = (value) => createHash("sha256").update(value).digest();
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const safeEqual = (a, b) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

export async function hashPassword(password) {
  if (typeof password !== "string" || password.length < 12 || password.length > 256) {
    throw new Error("PASSWORD_POLICY");
  }
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$16384$8$1$${salt.toString("base64url")}$${Buffer.from(derived).toString("base64url")}`;
}

export async function verifyPassword(password, encoded) {
  const [kind, n, r, p, saltText, hashText] = String(encoded || "").split("$");
  if (kind !== "scrypt" || !saltText || !hashText) return false;
  const expected = Buffer.from(hashText, "base64url");
  const actual = Buffer.from(await scrypt(password, Buffer.from(saltText, "base64url"), expected.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024,
  }));
  return safeEqual(actual, expected);
}

function masterKey() {
  const text = process.env.AEVOTRON_MASTER_KEY || "";
  const key = Buffer.from(text, "base64");
  if (key.length !== 32) throw new Error("MASTER_KEY_INVALID");
  return key;
}

export function encryptSecret(value, aad = "") {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), iv);
  cipher.setAAD(Buffer.from(aad));
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(value, aad = "") {
  const [version, ivText, tagText, dataText] = String(value || "").split(".");
  if (version !== "v1" || !ivText || !tagText || !dataText) throw new Error("CREDENTIAL_FORMAT_INVALID");
  const decipher = createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(ivText, "base64url"));
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataText, "base64url")), decipher.final()]).toString("utf8");
}

export function apiKeyHash(token) {
  const key = masterKey();
  return createHmac("sha256", key).update("AEVOTRON_API_KEY_V1:").update(token).digest();
}

export function createApiKey() {
  const secret = randomBytes(32).toString("base64url");
  const token = `mh_live_${secret}`;
  return { token, prefix: token.slice(0, 15), hash: apiKeyHash(token) };
}

export function createTotpSecret() {
  return randomBytes(20).toString("base32");
}

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function decodeBase32(value) {
  let bits = "";
  for (const char of value.toUpperCase().replace(/=+$/g, "")) {
    const index = BASE32.indexOf(char);
    if (index < 0) throw new Error("INVALID_TOTP_SECRET");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
function encodeBase32(buffer) {
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  let output = "";
  for (let i = 0; i < bits.length; i += 5) output += BASE32[parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)];
  return output;
}

export function newTotpSecret() {
  return encodeBase32(randomBytes(20));
}

export function totpCode(secret, time = Date.now(), step = 30) {
  const counter = Math.floor(time / 1000 / step);
  const counterBytes = Buffer.alloc(8);
  counterBytes.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", decodeBase32(secret)).update(counterBytes).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 1_000_000).padStart(6, "0");
}

export function verifyTotp(secret, code, time = Date.now()) {
  if (!/^\d{6}$/.test(String(code || ""))) return false;
  for (const delta of [-30_000, 0, 30_000]) {
    if (safeEqual(totpCode(secret, time + delta), String(code))) return true;
  }
  return false;
}

export function totpUri(secret, email) {
  const label = encodeURIComponent(`AEVOTRON:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=AEVOTRON&algorithm=SHA1&digits=6&period=30`;
}
