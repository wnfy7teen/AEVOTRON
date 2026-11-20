import { createClientFromRequest } from "npm:@base44/sdk";

const json = (data, status = 200) => Response.json(data, { status });
const enc = new TextEncoder();
const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const b64url = (bytes) => b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
const now = () => new Date().toISOString();

function masterSecret() {
  const value = Deno.env.get("AEVOTRON_MASTER_KEY");
  if (!value) throw new Error("MASTER_KEY_MISSING");
  const bytes = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  if (bytes.length !== 32) throw new Error("MASTER_KEY_INVALID");
  return bytes;
}

async function deriveHmacKey() {
  const raw = await crypto.subtle.importKey("raw", masterSecret(), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: enc.encode("AEVOTRON-MASTER-v1"), info: enc.encode("api-key-hmac") },
    raw,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    false,
    ["sign"],
  );
}

async function hashToken(token) {
  const key = await deriveHmacKey();
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(token));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function ensureWorkspace(base44, user) {
  const entities = base44.asServiceRole.entities;
  const rows = await entities.Workspace.filter(
    { owner_user_id: user.id }, "-created_date", 1, 0,
    ["id", "owner_user_id", "name", "region", "status"],
  );
  let workspace = rows[0];
  if (!workspace) {
    workspace = await entities.Workspace.create({
      owner_user_id: user.id, name: "Personal workspace", region: "global", status: "active",
    });
  }
  const members = await entities.WorkspaceMember.filter(
    { workspace_id: workspace.id, user_id: user.id, status: "active" }, "-created_date", 1, 0, ["id"],
  );
  if (!members.length) {
    await entities.WorkspaceMember.create({
      workspace_id: workspace.id, owner_user_id: user.id, user_id: user.id, role: "owner", status: "active",
    });
  }
  return workspace;
}

async function writeAudit(entities, user, workspace, action, keyId) {
  await entities.AuditEvent.create({
    workspace_id: workspace.id, owner_user_id: user.id, actor_user_id: user.id,
    action, target_type: "ApiKey", target_id: keyId || "",
    metadata_redacted_json: JSON.stringify({}), created_at: now(),
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: { code: "METHOD_NOT_ALLOWED" } }, 405);
  if (Number(req.headers.get("content-length") || 0) > 8000) {
    return json({ error: { code: "PAYLOAD_TOO_LARGE" } }, 413);
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user?.id) return json({ error: { code: "UNAUTHORIZED" } }, 401);

    const input = await req.json();
    const action = input?.action;
    if (!["list", "create", "revoke"].includes(action)) {
      return json({ error: { code: "INVALID_ACTION" } }, 400);
    }

    const workspace = await ensureWorkspace(base44, user);
    const entities = base44.asServiceRole.entities;
    const filter = { owner_user_id: user.id, workspace_id: workspace.id };

    if (action === "list") {
      const rows = await entities.ApiKey.filter(filter, "-created_date", 100, 0,
        ["id", "name", "key_prefix", "scopes_json", "last_used_at", "expires_at", "revoked_at", "status", "created_date"]);
      const keys = rows.map((key) => ({
        ...key,
        status: key.status === "active" && key.expires_at && Date.parse(key.expires_at) <= Date.now()
          ? "expired"
          : key.status,
      }));
      return json({ keys });
    }

    if (action === "create") {
      const name = typeof input.name === "string" ? input.name.trim() : "";
      if (!name || name.length > 60 || Array.from(name).some((char) => {
        const code = char.charCodeAt(0);
        return code < 32 || code === 127;
      })) {
        return json({ error: { code: "INVALID_KEY_NAME" } }, 400);
      }
      const activeKeys = await entities.ApiKey.filter({ ...filter, status: "active" }, "-created_date", 20, 0, ["id"]);
      if (activeKeys.length >= 20) {
        return json({ error: { code: "ACTIVE_KEY_LIMIT", message: "A workspace can have at most 20 active API keys." } }, 409);
      }
      const expiresIn = input.expires_in_days === undefined ? 90 : Number(input.expires_in_days);
      if (![30, 90, 365].includes(expiresIn)) {
        return json({ error: { code: "INVALID_EXPIRY" } }, 400);
      }

      const random = crypto.getRandomValues(new Uint8Array(32));
      const token = `mh_live_${b64url(random)}`;
      const keyHash = await hashToken(token);
      const expiresAt = new Date(Date.now() + expiresIn * 86400000).toISOString();
      const record = await entities.ApiKey.create({
        ...filter,
        name,
        key_prefix: token.slice(0, 16),
        key_hash: keyHash,
        scopes_json: JSON.stringify(["chat.completions"]),
        expires_at: expiresAt,
        status: "active",
      });
      await writeAudit(entities, user, workspace, "api_key.created", record.id);
      return json({
        key: token,
        warning: "This key is shown once. Copy it now; it cannot be retrieved later.",
        record: {
          id: record.id, name: record.name, key_prefix: record.key_prefix,
          status: record.status, expires_at: record.expires_at, created_date: record.created_date,
        },
      }, 201);
    }

    const keyId = typeof input.key_id === "string" ? input.key_id : "";
    if (!keyId || keyId.length > 100) return json({ error: { code: "INVALID_KEY_ID" } }, 400);
    const rows = await entities.ApiKey.filter({ ...filter, id: keyId }, "-created_date", 1, 0, ["id", "status"]);
    const key = rows[0];
    if (!key) return json({ error: { code: "KEY_NOT_FOUND" } }, 404);
    if (key.status === "revoked") return json({ success: true });

    await entities.ApiKey.update(key.id, { status: "revoked", revoked_at: now() });
    await writeAudit(entities, user, workspace, "api_key.revoked", key.id);
    return json({ success: true });
  } catch (error) {
    const missingKey = error?.message === "MASTER_KEY_MISSING" || error?.message === "MASTER_KEY_INVALID";
    return json({
      error: {
        code: missingKey ? "ENCRYPTION_NOT_CONFIGURED" : "INTERNAL_ERROR",
        message: missingKey ? "Server-side key protection is not configured yet." : "The request could not be completed.",
      },
    }, missingKey ? 503 : 500);
  }
});