import http from "node:http";
import { randomUUID, createHash } from "node:crypto";
import { pool, migrate, transaction } from "./db.js";
import {
  apiKeyHash, createApiKey, decryptSecret, encryptSecret, hashPassword,
  newTotpSecret, randomToken, sha256, totpCode, totpUri, verifyPassword, verifyTotp,
} from "./security.js";
import { mailConfigured, sendActionEmail } from "./mailer.js";

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || "0.0.0.0";
const SESSION_DAYS = 30;
const JSON_LIMIT = 64 * 1024;
const cookieName = "aevotron_session";
const now = () => new Date();
const json = (res, status, data, headers = {}) => {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "same-origin",
    "content-length": Buffer.byteLength(body),
    ...headers,
  });
  res.end(body);
};
const fail = (res, status, code, message) => json(res, status, { error: { code, message } });
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const validEmail = (value) => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c]));
const hashIp = (ip) => createHash("sha256").update(process.env.IP_HASH_SALT || "aevotron-ip-v1").update(ip || "").digest();

function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map((part) => {
    const index = part.indexOf("=");
    if (index < 0) return ["", ""];
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
}
function cookieHeader(token, maxAge) {
  const secure = process.env.COOKIE_SECURE !== "false";
  return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}
function clearCookie() {
  return `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.COOKIE_SECURE === "false" ? "" : "; Secure"}`;
}
async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > JSON_LIMIT) throw Object.assign(new Error("PAYLOAD_TOO_LARGE"), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("INVALID_JSON");
    return parsed;
  } catch {
    throw Object.assign(new Error("INVALID_JSON"), { status: 400 });
  }
}
function assertSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return;
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  if (!host || new URL(origin).host !== host || new URL(origin).protocol !== `${forwardedProto}:`) {
    throw Object.assign(new Error("ORIGIN_REJECTED"), { status: 403 });
  }
}
async function rateLimit(req, key, limit, windowSeconds) {
  const ip = req.socket.remoteAddress || "unknown";
  const bucket = `${key}:${hashIp(ip).toString("hex")}`;
  const start = new Date(Math.floor(Date.now() / (windowSeconds * 1000)) * windowSeconds * 1000);
  const result = await pool.query(
    `INSERT INTO rate_limit_buckets(bucket_key, window_start, hits)
     VALUES($1,$2,1)
     ON CONFLICT(bucket_key, window_start)
     DO UPDATE SET hits=rate_limit_buckets.hits+1
     RETURNING hits`,
    [bucket, start],
  );
  if (Number(result.rows[0].hits) > limit) {
    const retry = Math.max(1, Math.ceil((start.getTime() + windowSeconds * 1000 - Date.now()) / 1000));
    throw Object.assign(new Error("RATE_LIMITED"), { status: 429, retry });
  }
}
async function sessionUser(req) {
  const token = parseCookies(req.headers.cookie)[cookieName];
  if (!token) return null;
  const result = await pool.query(
    `SELECT u.id,u.email,u.display_name,u.email_verified_at,u.status,s.id AS session_id
     FROM sessions s JOIN users u ON u.id=s.user_id
     WHERE s.token_hash=$1 AND s.expires_at>now() AND u.status='active' AND u.email_verified_at IS NOT NULL`,
    [sha256(token)],
  );
  if (!result.rowCount) return null;
  await pool.query("UPDATE sessions SET last_seen_at=now() WHERE id=$1", [result.rows[0].session_id]);
  return result.rows[0];
}
async function requireUser(req, res) {
  const user = await sessionUser(req);
  if (!user) fail(res, 401, "UNAUTHORIZED", "Sign in to continue.");
  return user;
}
async function createSession(user, req, res) {
  const token = randomToken(32);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await pool.query(
    "INSERT INTO sessions(user_id,token_hash,user_agent,ip_hash,expires_at) VALUES($1,$2,$3,$4,$5)",
    [user.id, sha256(token), String(req.headers["user-agent"] || "").slice(0, 500), hashIp(req.socket.remoteAddress), expires],
  );
  res.setHeader("set-cookie", cookieHeader(token, SESSION_DAYS * 86400));
}
async function audit(client, userId, workspaceId, action, targetType = null, targetId = null, metadata = {}) {
  await client.query(
    `INSERT INTO audit_events(workspace_id,owner_user_id,actor_user_id,action,target_type,target_id,metadata_redacted)
     VALUES($1,$2,$2,$3,$4,$5,$6::jsonb)`,
    [workspaceId, userId, userId, action, targetType, targetId, JSON.stringify(metadata)],
  );
}
async function ensureWorkspace(user) {
  return transaction(async (client) => {
    const found = await client.query(
      "SELECT id,name,region,status FROM workspaces WHERE owner_user_id=$1 ORDER BY created_at LIMIT 1 FOR UPDATE",
      [user.id],
    );
    if (found.rowCount) return found.rows[0];
    const created = await client.query(
      "INSERT INTO workspaces(owner_user_id,name,region,status) VALUES($1,'Personal workspace','global','active') RETURNING id,name,region,status",
      [user.id],
    );
    await client.query(
      "INSERT INTO workspace_members(workspace_id,owner_user_id,user_id,role,status) VALUES($1,$2,$2,'owner','active')",
      [created.rows[0].id, user.id],
    );
    return created.rows[0];
  });
}
async function currentWorkspace(user) {
  const result = await pool.query(
    `SELECT w.id,w.name,w.region,w.status FROM workspaces w
     JOIN workspace_members m ON m.workspace_id=w.id
     WHERE w.owner_user_id=$1 AND m.user_id=$1 AND m.status='active' AND w.status='active'
     ORDER BY w.created_at LIMIT 1`,
    [user.id],
  );
  if (result.rowCount) return result.rows[0];
  return ensureWorkspace(user);
}
function publicUser(user) {
  return { id: user.id, email: user.email, display_name: user.display_name, email_verified: Boolean(user.email_verified_at) };
}
async function createVerification(user) {
  const token = randomToken(32);
  await pool.query(
    "INSERT INTO email_verification_tokens(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '30 minutes')",
    [user.id, sha256(token)],
  );
  const link = `${process.env.PUBLIC_APP_URL || "http://localhost:3000"}/verify-email?token=${encodeURIComponent(token)}`;
  const sent = await sendActionEmail({
    to: user.email,
    subject: "Verify your AEVOTRON account",
    text: `Verify your email by opening: ${link}`,
    html: `<p>Verify your AEVOTRON account:</p><p><a href="${escapeHtml(link)}">Verify email</a></p>`,
  });
  return sent ? null : token;
}
async function createPasswordReset(user) {
  const token = randomToken(32);
  await pool.query(
    "INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '20 minutes')",
    [user.id, sha256(token)],
  );
  const link = `${process.env.PUBLIC_APP_URL || "http://localhost:3000"}/reset-password?token=${encodeURIComponent(token)}`;
  const sent = await sendActionEmail({
    to: user.email,
    subject: "Reset your AEVOTRON password",
    text: `Reset your password by opening: ${link}`,
    html: `<p>Reset your AEVOTRON password:</p><p><a href="${escapeHtml(link)}">Reset password</a></p>`,
  });
  return sent ? null : token;
}
function parseApiKeyBearer(req) {
  const authorization = String(req.headers.authorization || "");
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}
function validateChat(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return "invalid_request";
  if (input.stream === true) return "unsupported_streaming";
  if (typeof input.model !== "string" || !/^[A-Za-z0-9._/-]{1,100}$/.test(input.model)) return "invalid_model";
  if (!Array.isArray(input.messages) || input.messages.length < 1 || input.messages.length > 50) return "invalid_messages";
  for (const message of input.messages) {
    if (!message || !["system", "user", "assistant"].includes(message.role) ||
        typeof message.content !== "string" || message.content.length > 20_000) return "invalid_messages";
  }
  if (input.max_tokens !== undefined && (!Number.isInteger(input.max_tokens) || input.max_tokens < 1 || input.max_tokens > 4096)) return "invalid_max_tokens";
  if (input.temperature !== undefined && (typeof input.temperature !== "number" || input.temperature < 0 || input.temperature > 2)) return "invalid_temperature";
  if (input.top_p !== undefined && (typeof input.top_p !== "number" || input.top_p < 0 || input.top_p > 1)) return "invalid_top_p";
  return null;
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const path = url.pathname;
  if (req.method === "GET" && path === "/healthz") return json(res, 200, { status: "ok" });
  if (req.method !== "GET" && req.method !== "HEAD") assertSameOrigin(req);
  const body = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) ? await readBody(req) : {};

  if (req.method === "POST" && path === "/api/v1/auth/register") {
    await rateLimit(req, "register", 5, 3600);
    if (process.env.NODE_ENV === "production" && !mailConfigured()) return fail(res, 503, "EMAIL_NOT_CONFIGURED", "Account email delivery is not configured.");
    const email = normalizeEmail(body.email);
    if (!validEmail(email)) return fail(res, 400, "INVALID_EMAIL", "Enter a valid email address.");
    const passwordHash = await hashPassword(body.password);
    const displayName = typeof body.display_name === "string" ? body.display_name.trim().slice(0, 80) : "";
    const user = await transaction(async (client) => {
      const inserted = await client.query(
        "INSERT INTO users(email,email_normalized,password_hash,display_name) VALUES($1,$1,$2,$3) ON CONFLICT(email_normalized) DO NOTHING RETURNING id,email,display_name",
        [email, passwordHash, displayName],
      );
      if (!inserted.rowCount) return null;
      const row = inserted.rows[0];
      const workspace = await client.query(
        "INSERT INTO workspaces(owner_user_id,name) VALUES($1,'Personal workspace') RETURNING id",
        [row.id],
      );
      await client.query(
        "INSERT INTO workspace_members(workspace_id,owner_user_id,user_id,role,status) VALUES($1,$2,$2,'owner','active')",
        [workspace.rows[0].id, row.id],
      );
      return row;
    });
    if (!user) return fail(res, 409, "ACCOUNT_EXISTS", "An account with this email already exists.");
    const verificationToken = await createVerification(user);
    return json(res, 201, { message: "Check your email to verify your account.", ...(verificationToken ? { development_verification_token: verificationToken } : {}) });
  }

  if (req.method === "POST" && path === "/api/v1/auth/verify-email") {
    await rateLimit(req, "verify-email", 10, 900);
    const token = String(body.token || "");
    if (token.length < 32 || token.length > 200) return fail(res, 400, "INVALID_TOKEN", "Verification link is invalid or expired.");
    const result = await pool.query(
      `UPDATE email_verification_tokens SET consumed_at=now()
       WHERE token_hash=$1 AND consumed_at IS NULL AND expires_at>now()
       RETURNING user_id`,
      [sha256(token)],
    );
    if (!result.rowCount) return fail(res, 400, "INVALID_TOKEN", "Verification link is invalid or expired.");
    const user = await pool.query(
      "UPDATE users SET email_verified_at=now(),updated_at=now() WHERE id=$1 RETURNING id,email,display_name,email_verified_at",
      [result.rows[0].user_id],
    );
    await createSession(user.rows[0], req, res);
    return json(res, 200, { user: publicUser(user.rows[0]) });
  }

  if (req.method === "POST" && path === "/api/v1/auth/login") {
    await rateLimit(req, "login", 10, 900);
    const email = normalizeEmail(body.email);
    const result = await pool.query(
      "SELECT id,email,display_name,password_hash,email_verified_at,status FROM users WHERE email_normalized=$1",
      [email],
    );
    const user = result.rows[0];
    const valid = user && user.status === "active" && await verifyPassword(String(body.password || ""), user.password_hash);
    if (!valid) return fail(res, 401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
    if (!user.email_verified_at) return fail(res, 403, "EMAIL_NOT_VERIFIED", "Verify your email before signing in.");
    const factor = await pool.query("SELECT id FROM mfa_factors WHERE user_id=$1 AND confirmed_at IS NOT NULL", [user.id]);
    if (factor.rowCount) {
      const challenge = randomToken(32);
      await pool.query(
        "INSERT INTO mfa_challenges(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '5 minutes')",
        [user.id, sha256(challenge)],
      );
      return json(res, 202, { mfa_required: true, mfa_challenge_token: challenge });
    }
    await createSession(user, req, res);
    return json(res, 200, { user: publicUser(user) });
  }

  if (req.method === "POST" && path === "/api/v1/auth/mfa/verify-login") {
    await rateLimit(req, "mfa-login", 8, 900);
    const challengeToken = String(body.challenge_token || "");
    const challenge = await pool.query(
      `SELECT c.id,c.user_id,u.email,u.display_name,u.email_verified_at,u.status
       FROM mfa_challenges c JOIN users u ON u.id=c.user_id
       WHERE c.token_hash=$1 AND c.consumed_at IS NULL AND c.expires_at>now() AND u.status='active'`,
      [sha256(challengeToken)],
    );
    if (!challenge.rowCount) return fail(res, 401, "MFA_CHALLENGE_EXPIRED", "Sign in again to continue.");
    const factor = await pool.query("SELECT secret_ciphertext FROM mfa_factors WHERE user_id=$1 AND confirmed_at IS NOT NULL", [challenge.rows[0].user_id]);
    if (!factor.rowCount) return fail(res, 401, "MFA_NOT_CONFIGURED", "Authenticator is not configured.");
    const secret = decryptSecret(factor.rows[0].secret_ciphertext, `totp:${challenge.rows[0].user_id}`);
    if (!verifyTotp(secret, body.code)) return fail(res, 401, "INVALID_MFA_CODE", "The authenticator code is invalid.");
    await pool.query("UPDATE mfa_challenges SET consumed_at=now() WHERE id=$1", [challenge.rows[0].id]);
    await createSession(challenge.rows[0], req, res);
    return json(res, 200, { user: publicUser(challenge.rows[0]) });
  }

  if (req.method === "POST" && path === "/api/v1/auth/logout") {
    const token = parseCookies(req.headers.cookie)[cookieName];
    if (token) await pool.query("DELETE FROM sessions WHERE token_hash=$1", [sha256(token)]);
    return json(res, 200, { success: true }, { "set-cookie": clearCookie() });
  }

  if (req.method === "GET" && path === "/api/v1/auth/me") {
    const user = await sessionUser(req);
    return user ? json(res, 200, { user: publicUser(user) }) : fail(res, 401, "UNAUTHORIZED", "Sign in to continue.");
  }

  if (req.method === "POST" && path === "/api/v1/auth/password/forgot") {
    await rateLimit(req, "password-reset", 5, 3600);
    const email = normalizeEmail(body.email);
    if (validEmail(email)) {
      const result = await pool.query("SELECT id,email FROM users WHERE email_normalized=$1 AND status='active'", [email]);
      if (result.rowCount) await createPasswordReset(result.rows[0]);
    }
    return json(res, 200, { message: "If the account exists, a password reset link will be sent." });
  }

  if (req.method === "POST" && path === "/api/v1/auth/password/reset") {
    await rateLimit(req, "password-reset-confirm", 5, 900);
    const token = String(body.token || "");
    const passwordHash = await hashPassword(body.password);
    const updated = await transaction(async (client) => {
      const row = await client.query(
        `UPDATE password_reset_tokens SET consumed_at=now()
         WHERE token_hash=$1 AND consumed_at IS NULL AND expires_at>now()
         RETURNING user_id`,
        [sha256(token)],
      );
      if (!row.rowCount) return null;
      await client.query("UPDATE users SET password_hash=$2,updated_at=now() WHERE id=$1", [row.rows[0].user_id, passwordHash]);
      await client.query("DELETE FROM sessions WHERE user_id=$1", [row.rows[0].user_id]);
      return row.rows[0].user_id;
    });
    return updated ? json(res, 200, { success: true }) : fail(res, 400, "INVALID_TOKEN", "Reset link is invalid or expired.");
  }

  if (req.method === "POST" && path === "/api/v1/auth/mfa/enroll") {
    const user = await requireUser(req, res); if (!user) return;
    const secret = newTotpSecret();
    const encrypted = encryptSecret(secret, `totp:${user.id}`);
    await pool.query(
      `INSERT INTO mfa_factors(user_id,type,secret_ciphertext,confirmed_at)
       VALUES($1,'totp',$2,NULL)
       ON CONFLICT(user_id,type) DO UPDATE SET secret_ciphertext=EXCLUDED.secret_ciphertext,confirmed_at=NULL,created_at=now()`,
      [user.id, encrypted],
    );
    return json(res, 200, { secret, otpauth_url: totpUri(secret, user.email) });
  }

  if (req.method === "POST" && path === "/api/v1/auth/mfa/confirm") {
    const user = await requireUser(req, res); if (!user) return;
    const factor = await pool.query("SELECT secret_ciphertext FROM mfa_factors WHERE user_id=$1 AND type='totp' AND confirmed_at IS NULL", [user.id]);
    if (!factor.rowCount) return fail(res, 404, "MFA_ENROLLMENT_NOT_FOUND", "Start authenticator setup first.");
    const secret = decryptSecret(factor.rows[0].secret_ciphertext, `totp:${user.id}`);
    if (!verifyTotp(secret, body.code)) return fail(res, 400, "INVALID_MFA_CODE", "The authenticator code is invalid.");
    await pool.query("UPDATE mfa_factors SET confirmed_at=now() WHERE user_id=$1 AND type='totp'", [user.id]);
    return json(res, 200, { success: true });
  }

  if (req.method === "POST" && path === "/api/v1/auth/mfa/disable") {
    const user = await requireUser(req, res); if (!user) return;
    const factor = await pool.query("SELECT secret_ciphertext FROM mfa_factors WHERE user_id=$1 AND confirmed_at IS NOT NULL", [user.id]);
    if (!factor.rowCount) return fail(res, 404, "MFA_NOT_CONFIGURED", "Authenticator is not configured.");
    const secret = decryptSecret(factor.rows[0].secret_ciphertext, `totp:${user.id}`);
    if (!verifyTotp(secret, body.code)) return fail(res, 400, "INVALID_MFA_CODE", "The authenticator code is invalid.");
    await pool.query("DELETE FROM mfa_factors WHERE user_id=$1", [user.id]);
    return json(res, 200, { success: true });
  }

  if (req.method === "GET" && path === "/api/v1/workspaces/current") {
    const user = await requireUser(req, res); if (!user) return;
    return json(res, 200, { workspace: await currentWorkspace(user) });
  }

  if (req.method === "POST" && path === "/api/v1/workspaces") {
    const user = await requireUser(req, res); if (!user) return;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 80) return fail(res, 400, "INVALID_WORKSPACE_NAME", "Workspace name must be 1–80 characters.");
    const workspace = await transaction(async (client) => {
      const row = await client.query(
        "INSERT INTO workspaces(owner_user_id,name) VALUES($1,$2) RETURNING id,name,region,status",
        [user.id, name],
      );
      await client.query(
        "INSERT INTO workspace_members(workspace_id,owner_user_id,user_id,role,status) VALUES($1,$2,$2,'owner','active')",
        [row.rows[0].id, user.id],
      );
      await audit(client, user.id, row.rows[0].id, "workspace.created", "workspace", row.rows[0].id);
      return row.rows[0];
    });
    return json(res, 201, { workspace });
  }

  if (req.method === "GET" && path === "/api/v1/api-keys") {
    const user = await requireUser(req, res); if (!user) return;
    const workspace = await currentWorkspace(user);
    const rows = await pool.query(
      `SELECT id,name,key_prefix,scopes,created_at,last_used_at,expires_at,revoked_at,
       (revoked_at IS NULL AND (expires_at IS NULL OR expires_at>now())) AS active
       FROM api_keys WHERE workspace_id=$1 AND owner_user_id=$2 ORDER BY created_at DESC`,
      [workspace.id, user.id],
    );
    return json(res, 200, { keys: rows.rows });
  }

  if (req.method === "POST" && path === "/api/v1/api-keys") {
    const user = await requireUser(req, res); if (!user) return;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name)) return fail(res, 400, "INVALID_KEY_NAME", "Key name must be 1–80 printable characters.");
    const workspace = await currentWorkspace(user);
    const count = await pool.query("SELECT count(*)::int AS n FROM api_keys WHERE workspace_id=$1 AND owner_user_id=$2 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>now())", [workspace.id, user.id]);
    if (count.rows[0].n >= 20) return fail(res, 409, "KEY_LIMIT_REACHED", "A workspace can have at most 20 active keys.");
    const generated = createApiKey();
    const expiry = body.expires_at ? new Date(body.expires_at) : null;
    if (expiry && (!Number.isFinite(expiry.getTime()) || expiry <= now() || expiry > new Date(Date.now() + 366 * 86400_000))) return fail(res, 400, "INVALID_EXPIRY", "Expiry must be within the next 366 days.");
    const row = await pool.query(
      "INSERT INTO api_keys(workspace_id,owner_user_id,name,key_prefix,key_hash,scopes,expires_at) VALUES($1,$2,$3,$4,$5,ARRAY['chat.completions'],$6) RETURNING id,name,key_prefix,scopes,created_at,expires_at",
      [workspace.id, user.id, name, generated.prefix, generated.hash, expiry],
    );
    await pool.query(
      "INSERT INTO audit_events(workspace_id,owner_user_id,actor_user_id,action,target_type,target_id) VALUES($1,$2,$2,'api_key.created','api_key',$3)",
      [workspace.id, user.id, row.rows[0].id],
    );
    return json(res, 201, { key: row.rows[0], secret: generated.token, message: "This key is shown once. Copy it now." });
  }

  const revokeMatch = path.match(/^\/api\/v1\/api-keys\/([0-9a-f-]{36})$/i);
  if (req.method === "DELETE" && revokeMatch) {
    const user = await requireUser(req, res); if (!user) return;
    const workspace = await currentWorkspace(user);
    const result = await pool.query(
      "UPDATE api_keys SET revoked_at=now() WHERE id=$1 AND workspace_id=$2 AND owner_user_id=$3 AND revoked_at IS NULL RETURNING id",
      [revokeMatch[1], workspace.id, user.id],
    );
    if (!result.rowCount) return fail(res, 404, "KEY_NOT_FOUND", "API key not found.");
    return json(res, 200, { success: true });
  }

  if (req.method === "POST" && path === "/api/v1/providers/openai") {
    const user = await requireUser(req, res); if (!user) return;
    const credential = String(body.api_key || "");
    if (!credential.startsWith("sk-") || credential.length < 20 || credential.length > 500) return fail(res, 400, "INVALID_PROVIDER_KEY", "Enter a valid OpenAI API key.");
    const workspace = await currentWorkspace(user);
    const ciphertext = encryptSecret(credential, `provider:openai:${user.id}:${workspace.id}`);
    const result = await pool.query(
      `INSERT INTO provider_connections(workspace_id,owner_user_id,provider_code,display_name,credential_ciphertext,status)
       VALUES($1,$2,'openai','OpenAI',$3,'pending')
       ON CONFLICT(workspace_id,provider_code) DO UPDATE SET credential_ciphertext=EXCLUDED.credential_ciphertext,status='pending',updated_at=now()
       RETURNING id,provider_code,display_name,status,last_tested_at`,
      [workspace.id, user.id, ciphertext],
    );
    return json(res, 201, { connection: result.rows[0] });
  }

  if (req.method === "POST" && path === "/api/v1/providers/openai/test") {
    const user = await requireUser(req, res); if (!user) return;
    const workspace = await currentWorkspace(user);
    const result = await pool.query(
      "SELECT id,credential_ciphertext FROM provider_connections WHERE workspace_id=$1 AND owner_user_id=$2 AND provider_code='openai' AND status<>'revoked'",
      [workspace.id, user.id],
    );
    if (!result.rowCount) return fail(res, 404, "PROVIDER_NOT_CONNECTED", "Connect OpenAI first.");
    const credential = decryptSecret(result.rows[0].credential_ciphertext, `provider:openai:${user.id}:${workspace.id}`);
    const upstream = await fetch("https://api.openai.com/v1/models", { headers: { authorization: `Bearer ${credential}` }, signal: AbortSignal.timeout(10_000) });
    await pool.query("UPDATE provider_connections SET status=$2,last_tested_at=now(),updated_at=now() WHERE id=$1", [result.rows[0].id, upstream.ok ? "active" : "error"]);
    if (!upstream.ok) return fail(res, 422, "PROVIDER_AUTH_FAILED", "The provider rejected this API key.");
    return json(res, 200, { success: true, status: "active" });
  }

  if (req.method === "DELETE" && path === "/api/v1/providers/openai") {
    const user = await requireUser(req, res); if (!user) return;
    const workspace = await currentWorkspace(user);
    await pool.query(
      "UPDATE provider_connections SET status='revoked',credential_ciphertext='',updated_at=now() WHERE workspace_id=$1 AND owner_user_id=$2 AND provider_code='openai'",
      [workspace.id, user.id],
    );
    return json(res, 200, { success: true });
  }

  if (req.method === "GET" && path === "/api/v1/providers") {
    const user = await requireUser(req, res); if (!user) return;
    const workspace = await currentWorkspace(user);
    const rows = await pool.query(
      "SELECT id,provider_code,display_name,status,last_tested_at FROM provider_connections WHERE workspace_id=$1 AND owner_user_id=$2 ORDER BY created_at DESC",
      [workspace.id, user.id],
    );
    return json(res, 200, { connections: rows.rows });
  }

  if (req.method === "GET" && path === "/api/v1/usage/summary") {
    const user = await requireUser(req, res); if (!user) return;
    const workspace = await currentWorkspace(user);
    const result = await pool.query(
      `SELECT count(*)::int AS requests,
       coalesce(sum(input_tokens+output_tokens),0)::bigint AS tokens,
       round(avg(NULLIF(latency_ms,0)))::int AS average_latency_ms,
       coalesce(round(100.0*count(*) FILTER(WHERE status_code>=400)/NULLIF(count(*),0),1),0) AS error_rate
       FROM usage_events WHERE workspace_id=$1 AND created_at>=now()-interval '30 days'`,
      [workspace.id],
    );
    return json(res, 200, { workspace, summary: { ...result.rows[0], period: "30d", generated_at: now().toISOString() } });
  }

  if (req.method === "GET" && path === "/api/v1/usage/events") {
    const user = await requireUser(req, res); if (!user) return;
    const workspace = await currentWorkspace(user);
    const rows = await pool.query(
      `SELECT id,request_id,model_id,provider_code,input_tokens,output_tokens,latency_ms,status_code,error_code,created_at
       FROM usage_events WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 50`,
      [workspace.id],
    );
    return json(res, 200, { events: rows.rows });
  }

  if (req.method === "GET" && path === "/api/v1/models") {
    const user = await requireUser(req, res); if (!user) return;
    const rows = await pool.query(
      "SELECT provider_code,provider_model_id,display_name,modality,context_window,capabilities,status FROM models WHERE status IN ('active','preview') ORDER BY provider_code,display_name",
    );
    return json(res, 200, { models: rows.rows });
  }

  if (req.method === "POST" && (path === "/api/v1/chat/completions" || path === "/v1/chat/completions")) {
    const invalid = validateChat(body);
    if (invalid) return fail(res, invalid === "unsupported_streaming" ? 400 : 400, invalid, "The chat completion request is invalid or unsupported.");
    const token = parseApiKeyBearer(req);
    if (!token.startsWith("mh_live_") || token.length > 100) return fail(res, 401, "invalid_api_key", "A valid AEVOTRON API key is required.");
    const lookup = await pool.query(
      "SELECT id,workspace_id,owner_user_id,expires_at,scopes FROM api_keys WHERE key_hash=$1 AND revoked_at IS NULL",
      [apiKeyHash(token)],
    );
    const key = lookup.rows[0];
    if (!key || (key.expires_at && key.expires_at <= now())) return fail(res, 401, "invalid_api_key", "The API key is invalid, revoked or expired.");
    if (!key.scopes.includes("chat.completions")) return fail(res, 403, "insufficient_scope", "This API key does not allow chat completions.");
    const workspace = await pool.query("SELECT id FROM workspaces WHERE id=$1 AND owner_user_id=$2 AND status='active'", [key.workspace_id, key.owner_user_id]);
    if (!workspace.rowCount) return fail(res, 403, "workspace_unavailable", "The workspace is unavailable.");
    const requestId = randomUUID();
    const client = await pool.connect();
    let responseStatus = 500, errorCode = "internal_error", inputTokens = 0, outputTokens = 0;
    const started = Date.now();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [key.id]);
      const recent = await client.query("SELECT count(*)::int AS n FROM usage_events WHERE api_key_id=$1 AND created_at>=now()-interval '1 minute'", [key.id]);
      if (recent.rows[0].n >= 30) {
        await client.query(
          "INSERT INTO usage_events(workspace_id,owner_user_id,api_key_id,request_id,status_code,error_code,latency_ms) VALUES($1,$2,$3,$4,429,'rate_limit_exceeded',$5)",
          [key.workspace_id,key.owner_user_id,key.id,requestId,Date.now()-started],
        );
        await client.query("COMMIT");
        return json(res, 429, { error: { message: "Rate limit exceeded. Try again in a minute.", type: "aevotron_error", code: "rate_limit_exceeded" } }, { "retry-after": "60", "x-request-id": requestId });
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
    const provider = await pool.query(
      "SELECT credential_ciphertext FROM provider_connections WHERE workspace_id=$1 AND owner_user_id=$2 AND provider_code='openai' AND status='active'",
      [key.workspace_id,key.owner_user_id],
    );
    if (!provider.rowCount) return fail(res, 403, "provider_not_connected", "Connect an OpenAI provider account before using this model.");
    const credential = decryptSecret(provider.rows[0].credential_ciphertext, `provider:openai:${key.owner_user_id}:${key.workspace_id}`);
    const model = body.model.startsWith("openai/") ? body.model.slice(7) : body.model;
    const upstreamBody = {
      model, messages: body.messages,
      ...(body.max_tokens !== undefined ? { max_tokens: body.max_tokens } : {}),
      ...(body.temperature !== undefined ? { temperature: body.temperature } : {}),
      ...(body.top_p !== undefined ? { top_p: body.top_p } : {}),
    };
    let upstream;
    try {
      upstream = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { authorization: `Bearer ${credential}`, "content-type": "application/json" },
        body: JSON.stringify(upstreamBody),
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      responseStatus = 504; errorCode = "upstream_timeout";
      await pool.query(
        "INSERT INTO usage_events(workspace_id,owner_user_id,api_key_id,model_id,provider_code,request_id,latency_ms,status_code,error_code) VALUES($1,$2,$3,$4,'openai',$5,$6,$7,$8)",
        [key.workspace_id,key.owner_user_id,key.id,model,requestId,Date.now()-started,responseStatus,errorCode],
      );
      return json(res, responseStatus, { error: { message: "The provider request timed out.", type: "aevotron_error", code: errorCode } }, { "x-request-id": requestId });
    }
    if (!upstream.ok) {
      responseStatus = upstream.status === 429 ? 429 : 502; errorCode = upstream.status === 429 ? "provider_rate_limited" : "upstream_provider_error";
      await upstream.body?.cancel().catch(() => {});
      await pool.query(
        "INSERT INTO usage_events(workspace_id,owner_user_id,api_key_id,model_id,provider_code,request_id,latency_ms,status_code,error_code) VALUES($1,$2,$3,$4,'openai',$5,$6,$7,$8)",
        [key.workspace_id,key.owner_user_id,key.id,model,requestId,Date.now()-started,responseStatus,errorCode],
      );
      return json(res, responseStatus, { error: { message: "The provider could not complete this request.", type: "aevotron_error", code: errorCode } }, { "x-request-id": requestId });
    }
    const result = await upstream.json();
    inputTokens = Number(result?.usage?.prompt_tokens || 0);
    outputTokens = Number(result?.usage?.completion_tokens || 0);
    responseStatus = 200;
    await pool.query("UPDATE api_keys SET last_used_at=now() WHERE id=$1", [key.id]);
    await pool.query(
      "INSERT INTO usage_events(workspace_id,owner_user_id,api_key_id,model_id,provider_code,request_id,input_tokens,output_tokens,latency_ms,status_code) VALUES($1,$2,$3,$4,'openai',$5,$6,$7,$8,200)",
      [key.workspace_id,key.owner_user_id,key.id,model,requestId,inputTokens,outputTokens,Date.now()-started],
    );
    return json(res, 200, result, { "x-request-id": requestId });
  }

  return fail(res, 404, "NOT_FOUND", "Route not found.");
}

const server = http.createServer(async (req, res) => {
  try {
    await handle(req, res);
  } catch (error) {
    if (res.headersSent) return res.destroy();
    if (error.status === 429) {
      return json(res, 429, { error: { code: "RATE_LIMITED", message: "Too many requests. Try again later." } }, { "retry-after": String(error.retry || 60) });
    }
    if (error.message === "PAYLOAD_TOO_LARGE") return fail(res, 413, "PAYLOAD_TOO_LARGE", "Request body exceeds 64 KB.");
    if (error.message === "INVALID_JSON") return fail(res, 400, "INVALID_JSON", "Request body must be a JSON object.");
    if (error.message === "ORIGIN_REJECTED") return fail(res, 403, "ORIGIN_REJECTED", "Cross-origin request rejected.");
    if (error.message === "MASTER_KEY_INVALID") return fail(res, 503, "ENCRYPTION_NOT_CONFIGURED", "Server-side encryption is not configured.");
    process.stderr.write(`[aevotron-api] request failed: ${error.message || "unknown"}\n`);
    return fail(res, 500, "INTERNAL_ERROR", "The request could not be completed.");
  }
});

await migrate();
server.listen(PORT, HOST, () => process.stdout.write(`AEVOTRON API listening on ${HOST}:${PORT}\n`));

async function shutdown() {
  server.close();
  await pool.end();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
