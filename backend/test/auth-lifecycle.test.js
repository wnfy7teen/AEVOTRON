import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/server.js", import.meta.url), "utf8");

test("MFA enrollment cannot replace a confirmed authenticator without step-up", () => {
  const start = source.indexOf('if (req.method === "POST" && path === "/api/v1/auth/mfa/enroll")');
  const end = source.indexOf('if (req.method === "POST" && path === "/api/v1/auth/mfa/confirm")', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const route = source.slice(start, end);
  assert.match(route, /confirmed_at IS NOT NULL/);
  assert.match(route, /MFA_ALREADY_CONFIGURED/);
  assert.match(route, /Disable the existing authenticator with its current code/);
  assert.ok(route.indexOf("confirmed.rowCount") < route.indexOf("newTotpSecret()"));
});

test("password reset serializes per-user token consumption and invalidates all auth paths", () => {
  const start = source.indexOf('if (req.method === "POST" && path === "/api/v1/auth/password/reset")');
  const end = source.indexOf('if (req.method === "GET" && path === "/api/v1/auth/mfa/status")', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const route = source.slice(start, end);
  assert.match(route, /SELECT id FROM users WHERE id=\$1 FOR UPDATE/);
  assert.match(route, /UPDATE password_reset_tokens SET consumed_at=now\(\) WHERE user_id=\$1 AND consumed_at IS NULL/);
  assert.match(route, /UPDATE mfa_challenges SET consumed_at=now\(\) WHERE user_id=\$1 AND consumed_at IS NULL/);
  assert.match(route, /DELETE FROM sessions WHERE user_id=\$1/);
  assert.ok(route.indexOf("FOR UPDATE") < route.indexOf("UPDATE password_reset_tokens SET consumed_at=now()"));
});

test("password change rejects reusing the current password server-side", () => {
  const start = source.indexOf('if (req.method === "POST" && path === "/api/v1/auth/password/change")');
  const end = source.indexOf('if (req.method === "POST" && path === "/api/v1/auth/password/forgot")', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const route = source.slice(start, end);
  assert.match(route, /verifyPassword\(nextPassword, account\.rows\[0\]\.password_hash\)/);
  assert.match(route, /PASSWORD_UNCHANGED/);
  assert.ok(route.indexOf("PASSWORD_UNCHANGED") < route.indexOf("hashPassword(nextPassword)"));
  assert.match(route, /Choose a new password that differs from your current password/);
});
