import { createFileRoute } from "@tanstack/react-router";

const MAX_BODY_BYTES = 1024 * 1024;
const MAX_MESSAGES = 50;
const MAX_MESSAGE_CHARS = 20_000;
const ACCESS_JWKS_TTL_MS = 5 * 60_000;
let cachedJwks = null;
let cachedJwksAt = 0;

function json(status, data) {
  return Response.json(data, {
    status,
    headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function decodeJwtPart(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

async function getAccessJwks(teamDomain) {
  if (cachedJwks && Date.now() - cachedJwksAt < ACCESS_JWKS_TTL_MS) return cachedJwks;
  const response = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error("ACCESS_KEYS_UNAVAILABLE");
  const data = await response.json();
  if (!Array.isArray(data.keys)) throw new Error("ACCESS_KEYS_INVALID");
  cachedJwks = data.keys;
  cachedJwksAt = Date.now();
  return cachedJwks;
}

async function isAccessAuthorized(request) {
  const teamDomain = String(process.env.CF_ACCESS_TEAM_DOMAIN || "").trim().replace("https://", "").replace("http://", "").split("/")[0];
  const audience = String(process.env.CF_ACCESS_AUD || "").trim();
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!teamDomain || !audience || !token) return false;

  try {
    const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
    if (!encodedHeader || !encodedPayload || !encodedSignature) return false;
    const header = decodeJwtPart(encodedHeader);
    const claims = decodeJwtPart(encodedPayload);
    if (header.alg !== "RS256" || !header.kid) return false;

    const issuer = `https://${teamDomain}/cdn-cgi/access/get-identity`;
    const now = Math.floor(Date.now() / 1000);
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (claims.iss !== issuer || !audiences.includes(audience) ||
        !Number.isFinite(claims.exp) || claims.exp <= now ||
        (Number.isFinite(claims.nbf) && claims.nbf > now) ||
        typeof claims.sub !== "string" || !claims.sub) return false;

    const jwks = await getAccessJwks(teamDomain);
    const jwk = jwks.find((key) => key.kid === header.kid && key.kty === "RSA");
    if (!jwk) return false;
    const publicKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const signedContent = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
    return crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      publicKey,
      decodeBase64Url(encodedSignature),
      signedContent,
    );
  } catch {
    return false;
  }
}

async function listGroqModels() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return json(503, { error: { code: "GROQ_NOT_CONFIGURED", message: "Groq is not configured on this preview." } });
  try {
    const upstream = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { authorization: `Bearer ${apiKey}`, accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!upstream.ok) return json(upstream.status === 401 ? 502 : upstream.status, {
      error: { code: "GROQ_MODELS_FAILED", message: "Groq model catalog could not be loaded." },
    });
    const data = await upstream.json();
    const models = (Array.isArray(data.data) ? data.data : [])
      .filter((model) => model && typeof model.id === "string" &&
        !/(whisper|speech|transcription|tts|embed|guard)/i.test(model.id))
      .map((model) => ({
        id: `groq/${model.id}`,
        provider_model_id: model.id,
        provider_code: "groq",
        owned_by: model.owned_by || "Groq",
      }));
    return json(200, { models });
  } catch {
    return json(502, { error: { code: "GROQ_UNAVAILABLE", message: "Groq is temporarily unavailable." } });
  }
}

async function createGroqCompletion(request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return json(503, { error: { code: "GROQ_NOT_CONFIGURED", message: "Groq is not configured on this preview." } });

  let body;
  try {
    const raw = await request.arrayBuffer();
    if (raw.byteLength > MAX_BODY_BYTES) return json(413, { error: { code: "PAYLOAD_TOO_LARGE", message: "The request is too large." } });
    body = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return json(400, { error: { code: "INVALID_JSON", message: "The request body must be valid JSON." } });
  }

  const model = typeof body.model === "string" ? body.model : "";
  const providerModel = model.startsWith("groq/") ? model.slice(5) : "";
  if (!providerModel || !/^[A-Za-z0-9._/-]{1,150}$/.test(providerModel) ||
      providerModel.includes("..") || !Array.isArray(body.messages) ||
      body.messages.length < 1 || body.messages.length > MAX_MESSAGES ||
      body.messages.some((message) => !message ||
        !["system", "user", "assistant"].includes(message.role) ||
        typeof message.content !== "string" || message.content.length > MAX_MESSAGE_CHARS) ||
      body.stream !== true) {
    return json(400, { error: { code: "INVALID_REQUEST", message: "The model, messages, or streaming options are invalid." } });
  }
  if (body.max_tokens !== undefined &&
      (!Number.isInteger(body.max_tokens) || body.max_tokens < 1 || body.max_tokens > 4096)) {
    return json(400, { error: { code: "INVALID_MAX_TOKENS", message: "max_tokens must be between 1 and 4096." } });
  }
  if (body.temperature !== undefined &&
      (typeof body.temperature !== "number" || body.temperature < 0 || body.temperature > 2)) {
    return json(400, { error: { code: "INVALID_TEMPERATURE", message: "temperature must be between 0 and 2." } });
  }

  try {
    const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        accept: "text/event-stream",
      },
      body: JSON.stringify({
        model: providerModel,
        messages: body.messages,
        stream: true,
        stream_options: { include_usage: true },
        ...(body.max_tokens !== undefined ? { max_tokens: body.max_tokens } : {}),
        ...(body.temperature !== undefined ? { temperature: body.temperature } : {}),
        ...(body.top_p !== undefined ? { top_p: body.top_p } : {}),
      }),
      signal: AbortSignal.timeout(120_000),
    });
    const headers = new Headers(upstream.headers);
    headers.set("cache-control", "no-store");
    headers.set("x-content-type-options", "nosniff");
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return json(502, { error: { code: "GROQ_UNAVAILABLE", message: "Groq could not complete the request." } });
  }
}

async function handleGroqRequest({ request }) {
  if (!(await isAccessAuthorized(request))) {
    return json(403, { error: { code: "ACCESS_REQUIRED", message: "This temporary Groq endpoint requires Cloudflare Access." } });
  }

  const path = new URL(request.url).pathname;
  if (request.method === "GET" && path === "/api/groq/models") return listGroqModels();
  if (request.method === "POST" && path === "/api/groq/chat/completions") return createGroqCompletion(request);
  return json(404, { error: { code: "NOT_FOUND", message: "Endpoint not found." } });
}

export const Route = createFileRoute("/api/groq/$")({
  server: {
    handlers: {
      GET: handleGroqRequest,
      POST: handleGroqRequest,
      OPTIONS: () => new Response(null, { status: 204 }),
    },
  },
});
