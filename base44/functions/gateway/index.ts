import { createClientFromRequest } from "npm:@base44/sdk";

const json = (data, status = 200, headers = {}) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
const enc = new TextEncoder();
const b64 = (bytes) => Uint8Array.from(atob(bytes), (c) => c.charCodeAt(0));
const now = () => new Date().toISOString();
const requestId = () => crypto.randomUUID();

function masterSecret() {
  const value = Deno.env.get("AEVOTRON_MASTER_KEY");
  if (!value) throw new Error("MASTER_KEY_MISSING");
  const bytes = b64(value);
  if (bytes.length !== 32) throw new Error("MASTER_KEY_INVALID");
  return bytes;
}

async function deriveKey(purpose, algorithm, usages) {
  const raw = await crypto.subtle.importKey("raw", masterSecret(), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: enc.encode("AEVOTRON-MASTER-v1"), info: enc.encode(purpose) },
    raw, algorithm, false, usages,
  );
}

async function hashToken(token) {
  const key = await deriveKey("api-key-hmac", { name: "HMAC", hash: "SHA-256", length: 256 }, ["sign"]);
  const bytes = await crypto.subtle.sign("HMAC", key, enc.encode(token));
  return Array.from(new Uint8Array(bytes), (v) => v.toString(16).padStart(2, "0")).join("");
}

async function decryptCredential(value, ownerId, workspaceId, provider) {
  const [version, ivText, cipherText] = String(value || "").split(".");
  if (version !== "v1" || !ivText || !cipherText) throw new Error("CREDENTIAL_FORMAT_INVALID");
  const key = await deriveKey("provider-credentials", { name: "AES-GCM", length: 256 }, ["decrypt"]);
  const plain = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: b64(ivText),
      additionalData: enc.encode(`${ownerId}:${workspaceId}:${provider}:v1`),
    },
    key,
    b64(cipherText),
  );
  return new TextDecoder().decode(plain);
}

function validatePayload(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return "invalid_request";
  if (input.stream === true) return "unsupported_streaming";
  if (typeof input.model !== "string" || input.model.length > 100) return "invalid_model";
  const model = input.model.startsWith("openai/") ? input.model.slice(7) : input.model;
  if (!/^[A-Za-z0-9._-]{1,90}$/.test(model)) return "invalid_model";
  if (!Array.isArray(input.messages) || input.messages.length < 1 || input.messages.length > 50) return "invalid_messages";
  for (const message of input.messages) {
    if (!message || !["system", "user", "assistant"].includes(message.role)) return "invalid_messages";
    if (typeof message.content !== "string" || message.content.length > 20000) return "invalid_messages";
  }
  if (input.max_tokens !== undefined &&
      (!Number.isInteger(input.max_tokens) || input.max_tokens < 1 || input.max_tokens > 4096)) return "invalid_max_tokens";
  if (input.temperature !== undefined &&
      (typeof input.temperature !== "number" || !Number.isFinite(input.temperature) || input.temperature < 0 || input.temperature > 2)) return "invalid_temperature";
  if (input.top_p !== undefined &&
      (typeof input.top_p !== "number" || !Number.isFinite(input.top_p) || input.top_p < 0 || input.top_p > 1)) return "invalid_top_p";
  return null;
}

function safeError(code, message, status) {
  return json({ error: { message, type: "aevotron_error", code } }, status);
}

Deno.serve(async (req) => {
  const rid = requestId();
  if (req.method !== "POST") return safeError("method_not_allowed", "Only POST is supported.", 405);
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return safeError("invalid_content_type", "Send a JSON request body.", 415);
  }

  let raw;
  try {
    raw = await req.text();
  } catch {
    return safeError("invalid_request", "The request body could not be read.", 400);
  }
  if (raw.length > 65536) return safeError("payload_too_large", "The request body exceeds 64 KB.", 413);

  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return safeError("invalid_json", "The request body must be valid JSON.", 400);
  }
  const invalid = validatePayload(input);
  if (invalid) {
    const messages = {
      unsupported_streaming: "Streaming is not supported in this beta.",
      invalid_model: "Use an OpenAI model ID, optionally prefixed with openai/.",
      invalid_messages: "Provide 1–50 text messages with system, user or assistant roles.",
      invalid_max_tokens: "max_tokens must be an integer between 1 and 4096.",
      invalid_temperature: "temperature must be between 0 and 2.",
      invalid_top_p: "top_p must be between 0 and 1.",
    };
    return safeError(invalid, messages[invalid] || "The request is invalid.", 400);
  }

  const authorization = req.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token.startsWith("mh_live_") || token.length > 100) {
    return safeError("invalid_api_key", "A valid AEVOTRON API key is required.", 401);
  }

  const started = Date.now();
  let ownerId = "";
  let workspaceId = "";
  let keyId = "";
  let providerCode = "openai";
  let inputTokens = 0;
  let outputTokens = 0;
  let statusCode = 500;
  let errorCode = "";
  let entities = null;

  try {
    const base44 = createClientFromRequest(req);
    entities = base44.asServiceRole.entities;
    const hash = await hashToken(token);
    const keys = await entities.ApiKey.filter({ key_hash: hash, status: "active" }, "-created_date", 1, 0,
      ["id", "owner_user_id", "workspace_id", "expires_at", "status", "scopes_json"]);
    const apiKey = keys[0];
    if (!apiKey) {
      return safeError("invalid_api_key", "The API key is invalid or revoked.", 401);
    }
    if (apiKey.expires_at && Date.parse(apiKey.expires_at) <= Date.now()) {
      return safeError("expired_api_key", "The API key has expired.", 401);
    }
    let scopes = [];
    try { scopes = JSON.parse(apiKey.scopes_json || "[]"); } catch { scopes = []; }
    if (!Array.isArray(scopes) || !scopes.includes("chat.completions")) {
      return safeError("insufficient_scope", "This API key does not allow chat completions.", 403);
    }
    ownerId = apiKey.owner_user_id;
    workspaceId = apiKey.workspace_id;
    keyId = apiKey.id;

    const workspaces = await entities.Workspace.filter(
      { id: workspaceId, owner_user_id: ownerId, status: "active" }, "-created_date", 1, 0, ["id"],
    );
    if (!workspaces.length) return safeError("workspace_unavailable", "The workspace is unavailable.", 403);

    // Best-effort per-key guard. Base44 entity CRUD has no atomic counter, so this is
    // not a distributed concurrency limit; a durable atomic limiter is required at scale.
    const recentUsage = await entities.UsageEvent.filter(
      { workspace_id: workspaceId, owner_user_id: ownerId, api_key_id: keyId },
      "-created_date", 30, 0, ["created_at"],
    );
    const minuteAgo = Date.now() - 60_000;
    const recentCount = recentUsage.filter((event) => {
      const timestamp = Date.parse(event.created_at || event.created_date || "");
      return Number.isFinite(timestamp) && timestamp >= minuteAgo;
    }).length;
    if (recentCount >= 30) {
      await entities.UsageEvent.create({
        workspace_id: workspaceId, owner_user_id: ownerId, api_key_id: keyId,
        model_id: input.model, provider_code: providerCode, request_id: rid,
        input_tokens: 0, output_tokens: 0, latency_ms: Date.now() - started,
        status_code: 429, error_code: "rate_limit_exceeded", created_at: now(),
      });
      return json({
        error: { message: "Rate limit exceeded. Try again in a minute.", type: "aevotron_error", code: "rate_limit_exceeded" },
      }, 429, { "Retry-After": "60", "x-request-id": rid });
    }

    const connections = await entities.ProviderConnection.filter(
      { workspace_id: workspaceId, owner_user_id: ownerId, provider_code: providerCode, status: "active" },
      "-created_date", 1, 0, ["id", "credential_ciphertext", "credential_key_version", "status"],
    );
    const connection = connections[0];
    if (!connection?.credential_ciphertext) {
      return safeError("provider_not_connected", "Connect an OpenAI provider account before using this model.", 403);
    }

    const credential = await decryptCredential(
      connection.credential_ciphertext, ownerId, workspaceId, providerCode,
    );
    const model = input.model.startsWith("openai/") ? input.model.slice(7) : input.model;
    const upstreamBody = {
      model,
      messages: input.messages,
      ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
      ...(input.top_p !== undefined ? { top_p: input.top_p } : {}),
      ...(input.max_tokens !== undefined ? { max_tokens: input.max_tokens } : {}),
      ...(input.presence_penalty !== undefined ? { presence_penalty: input.presence_penalty } : {}),
      ...(input.frequency_penalty !== undefined ? { frequency_penalty: input.frequency_penalty } : {}),
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    let upstream;
    try {
      upstream = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${credential}`, "Content-Type": "application/json" },
        body: JSON.stringify(upstreamBody),
        signal: controller.signal,
      });
    } catch {
      statusCode = 504;
      errorCode = "upstream_timeout";
      await entities.UsageEvent.create({
        workspace_id: workspaceId, owner_user_id: ownerId, api_key_id: keyId,
        provider_code: providerCode, request_id: rid, input_tokens: 0, output_tokens: 0,
        latency_ms: Date.now() - started, status_code: statusCode, error_code: errorCode, created_at: now(),
      });
      return json({ error: { message: "The provider request timed out.", type: "aevotron_error", code: errorCode } },
        statusCode, { "x-request-id": rid });
    } finally {
      clearTimeout(timeout);
    }

    if (!upstream.ok) {
      statusCode = upstream.status === 429 ? 429 : 502;
      errorCode = upstream.status === 429 ? "provider_rate_limited" : "upstream_provider_error";
      await upstream.body?.cancel().catch(() => {});
      await entities.UsageEvent.create({
        workspace_id: workspaceId, owner_user_id: ownerId, api_key_id: keyId,
        provider_code: providerCode, request_id: rid, input_tokens: 0, output_tokens: 0,
        latency_ms: Date.now() - started, status_code: statusCode, error_code: errorCode, created_at: now(),
      });
      return json({ error: { message: "The provider could not complete this request.", type: "aevotron_error", code: errorCode } },
        statusCode, { "x-request-id": rid });
    }

    const result = await upstream.json();
    inputTokens = Number(result?.usage?.prompt_tokens || 0);
    outputTokens = Number(result?.usage?.completion_tokens || 0);
    statusCode = 200;
    await entities.ApiKey.update(keyId, { last_used_at: now() });
    await entities.UsageEvent.create({
      workspace_id: workspaceId, owner_user_id: ownerId, api_key_id: keyId,
      model_id: model, provider_code: providerCode, request_id: rid,
      input_tokens: inputTokens, output_tokens: outputTokens,
      latency_ms: Date.now() - started, status_code: statusCode, created_at: now(),
    });
    return json(result, 200, { "x-request-id": rid });
  } catch (error) {
    const missingKey = error?.message === "MASTER_KEY_MISSING" || error?.message === "MASTER_KEY_INVALID";
    errorCode = missingKey ? "encryption_not_configured" : "internal_error";
    statusCode = missingKey ? 503 : 500;
    if (ownerId && workspaceId) {
      try {
        await entities.UsageEvent.create({
          workspace_id: workspaceId, owner_user_id: ownerId, api_key_id: keyId,
          provider_code: providerCode, request_id: rid, input_tokens: inputTokens,
          output_tokens: outputTokens, latency_ms: Date.now() - started,
          status_code: statusCode, error_code: errorCode, created_at: now(),
        });
      } catch { /* Usage persistence must not leak request data or replace the safe error. */ }
    }
    return json({
      error: {
        message: missingKey ? "Gateway encryption is not configured." : "The request could not be completed.",
        type: "aevotron_error",
        code: errorCode,
      },
    }, statusCode, { "x-request-id": rid });
  }
});