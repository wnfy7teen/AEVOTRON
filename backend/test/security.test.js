import test from "node:test";
import assert from "node:assert/strict";
import {
  createApiKey, decryptSecret, encryptSecret, hashPassword, newTotpSecret,
  sha256, totpCode, totpUri, verifyPassword, verifyTotp,
} from "../src/security.js";

process.env.AEVOTRON_MASTER_KEY = Buffer.alloc(32, 7).toString("base64");

test("password hashes are salted, non-reversible and verify correctly", async () => {
  const encoded = await hashPassword("correct horse battery staple");
  assert.match(encoded, /^scrypt\$16384\$8\$1\$/);
  assert.notEqual(encoded, "correct horse battery staple");
  assert.equal(await verifyPassword("correct horse battery staple", encoded), true);
  assert.equal(await verifyPassword("wrong password", encoded), false);
});

test("password policy rejects short and oversized values", async () => {
  await assert.rejects(hashPassword("short"), /PASSWORD_POLICY/);
  await assert.rejects(hashPassword("x".repeat(257)), /PASSWORD_POLICY/);
});

test("opaque session and verification tokens can be stored as one-way hashes", () => {
  assert.equal(sha256("token").length, 32);
  assert.notEqual(sha256("token").toString("hex"), "token");
});

test("provider credentials are authenticated-encrypted and bound to their owner context", () => {
  const cipher = encryptSecret("sk-example-secret", "provider:openai:user-1:workspace-1");
  assert.equal(decryptSecret(cipher, "provider:openai:user-1:workspace-1"), "sk-example-secret");
  assert.throws(() => decryptSecret(cipher, "provider:openai:user-2:workspace-1"));
  assert.throws(() => decryptSecret(cipher, "provider:openai:user-1:workspace-2"));
});

test("API keys are high entropy, prefixed, and only expose a one-way HMAC digest", () => {
  const first = createApiKey();
  const second = createApiKey();
  assert.match(first.token, /^mh_live_[A-Za-z0-9_-]{43}$/);
  assert.equal(first.prefix, first.token.slice(0, 15));
  assert.equal(first.hash.length, 32);
  assert.notEqual(first.hash.toString("hex"), first.token);
  assert.notEqual(first.token, second.token);
});

test("TOTP implementation matches RFC 6238 SHA-1 test vector", () => {
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  assert.equal(totpCode(secret, 59_000), "287082");
  assert.equal(verifyTotp(secret, "287082", 59_000), true);
  assert.equal(verifyTotp(secret, "000000", 59_000), false);
});

test("TOTP enrollment creates a valid authenticator URI", () => {
  const secret = newTotpSecret();
  assert.match(secret, /^[A-Z2-7]{32}$/);
  assert.match(totpUri(secret, "user@example.com"), /^otpauth:\/\/totp\/AEVOTRON%3Auser%40example.com\?/);
});

test("password verification rejects attacker-controlled scrypt parameters and malformed hashes", async () => {
  const encoded = await hashPassword("correct horse battery staple");
  const [, , , , salt, hash] = encoded.split("$");
  assert.equal(await verifyPassword("correct horse battery staple", `scrypt$999999$8$1$${salt}$${hash}`), false);
  assert.equal(await verifyPassword("correct horse battery staple", `scrypt$16384$8$1$${salt}$short`), false);
  assert.equal(await verifyPassword("x".repeat(257), encoded), false);
  assert.equal(await verifyPassword(null, encoded), false);
});
