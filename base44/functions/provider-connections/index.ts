import { createClientFromRequest } from "npm:@base44/sdk";

const json = (data, status = 200) => Response.json(data, { status });
const enc = new TextEncoder();
const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (value) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
const now = () => new Date().toISOString();

function masterSecret() {
  const value = Deno.env.get("AEVOTRON_MASTER_KEY");
  if (!value) throw new Error("MASTER_KEY_MISSING");
  const bytes = unb64(value);
  if (bytes.length !== 32) throw new Error("MASTER_KEY_INVALID");
  return bytes;
}

async function deriveKey(purpose, algorithm, usages) {
  const raw = await crypto.subtle.importKey("raw", masterSecret(), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: enc.encode("AEVOTRON-MASTER-v1"), info: enc.encode(purpose) },
    raw,
    algorithm,
    false,
    usages,
  );
}

async function encryptCredential(plain, ownerId, workspaceId, provider) {
  const key = await deriveKey("provider-credentials", { name: "AES-GCM", length: 256 }, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aad = enc.encode(`${ownerId}:${workspaceId}:${provider}:v1`);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad }, key, enc.encode(plain));
  return `v1.${b64(iv)}.${b64(cipher)}`;
}

async function decryptCredential(value, ownerId, workspaceId, provider) {
  const [version, ivText, cipherText] = String(value || "").split(".");
  if (version !== "v1" || !ivText || !cipherText) throw new Error("CREDENTIAL_FORMAT_INVALID");
  const key = await deriveKey("provider-credentials", { name: "AES-GCM", length: 256 }, ["decrypt"]);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(ivText), additionalData: enc.encode(`${ownerId}:${workspaceId}:${provider}:v1`) },
    key,
    unb64(cipherText),
  );
  return new TextDecoder().decode(plain);
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

async function testOpenAIKey(apiKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function audit(entities, user, workspace, action, targetId, provider) {
  await entities.AuditEvent.create({
    workspace_id: workspace.id,
    owner_user_id: user.id,
    actor_user_id: user.id,
    action,
    target_type: "ProviderConnection",
    target_id: targetId || "",
    metadata_redacted_json: JSON.stringify({ provider_code: provider }),
    created_at: now(),
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: { code: "METHOD_NOT_ALLOWED" } }, 405);
  const length = Number(req.headers.get("content-length") || 0);
  if (length > 12000) return json({ error: { code: "PAYLOAD_TOO_LARGE" } }, 413);

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user?.id) return json({ error: { code: "UNAUTHORIZED" } }, 401);

    const input = await req.json();
    const action = input?.action;
    if (!["list", "connect", "test", "revoke"].includes(action)) {
      return json({ error: { code: "INVALID_ACTION" } }, 400);
    }

    const workspace = await ensureWorkspace(base44, user);
    const entities = base44.asServiceRole.entities;
    const filter = { owner_user_id: user.id, workspace_id: workspace.id };

    if (action === "list") {
      const rows = await entities.ProviderConnection.filter(filter, "-created_date", 100, 0,
        ["id", "provider_code", "display_name", "status", "last_tested_at", "created_date"]);
      return json({ connections: rows });
    }

    if (action === "connect") {
      const provider = input.provider_code;
      const credential = typeof input.credential === "string" ? input.credential.trim() : "";
      if (provider !== "openai") return json({ error: { code: "PROVIDER_NOT_SUPPORTED" } }, 400);
      if (credential.length < 20 || credential.length > 500) {
        return json({ error: { code: "INVALID_CREDENTIAL" } }, 400);
      }
      if (!(await testOpenAIKey(credential))) {
        return json({ error: { code: "PROVIDER_AUTH_FAILED", message: "OpenAI rejected this credential or could not be reached." } }, 422);
      }

      const ciphertext = await encryptCredential(credential, user.id, workspace.id, provider);
      const existing = await entities.ProviderConnection.filter(
        { ...filter, provider_code: provider }, "-created_date", 1, 0, ["id"],
      );
      const payload = {
        ...filter, provider_code: provider, display_name: "OpenAI",
        credential_ciphertext: ciphertext, credential_key_version: "v1",
        status: "active", last_tested_at: now(),
      };
      const record = existing[0]
        ? await entities.ProviderConnection.update(existing[0].id, payload)
        : await entities.ProviderConnection.create(payload);
      await audit(entities, user, workspace, "provider.connected", record.id, provider);
      return json({ connection: {
        id: record.id, provider_code: record.provider_code, display_name: record.display_name,
        status: record.status, last_tested_at: record.last_tested_at,
      } });
    }

    const connectionId = typeof input.connection_id === "string" ? input.connection_id : "";
    if (!connectionId || connectionId.length > 100) return json({ error: { code: "INVALID_CONNECTION_ID" } }, 400);
    const rows = await entities.ProviderConnection.filter(
      { ...filter, id: connectionId }, "-created_date", 1, 0,
      ["id", "provider_code", "credential_ciphertext", "credential_key_version", "status"],
    );
    const connection = rows[0];
    if (!connection) return json({ error: { code: "CONNECTION_NOT_FOUND" } }, 404);

    if (action === "revoke") {
      await entities.ProviderConnection.update(connection.id, {
        status: "revoked", credential_ciphertext: "", last_tested_at: now(),
      });
      await audit(entities, user, workspace, "provider.revoked", connection.id, connection.provider_code);
      return json({ success: true });
    }

    if (connection.status === "revoked" || !connection.credential_ciphertext) {
      return json({ error: { code: "PROVIDER_NOT_CONNECTED" } }, 409);
    }
    const credential = await decryptCredential(
      connection.credential_ciphertext, user.id, workspace.id, connection.provider_code,
    );
    const ok = connection.provider_code === "openai" && await testOpenAIKey(credential);
    await entities.ProviderConnection.update(connection.id, {
      status: ok ? "active" : "error", last_tested_at: now(),
    });
    await audit(entities, user, workspace, ok ? "provider.test_succeeded" : "provider.test_failed",
      connection.id, connection.provider_code);
    return json({ success: ok, status: ok ? "active" : "error" }, ok ? 200 : 422);
  } catch (error) {
    const missingKey = error?.message === "MASTER_KEY_MISSING" || error?.message === "MASTER_KEY_INVALID";
    return json({
      error: {
        code: missingKey ? "ENCRYPTION_NOT_CONFIGURED" : "INTERNAL_ERROR",
        message: missingKey ? "Server-side encryption is not configured yet." : "The request could not be completed.",
      },
    }, missingKey ? 503 : 500);
  }
});