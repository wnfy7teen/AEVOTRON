async function request(path, { method = "GET", body } = {}) {
  const response = await fetch(path, {
    method,
    credentials: "include",
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error?.message || data.error?.code || "Request failed");
    error.status = response.status;
    error.code = data.error?.code;
    throw error;
  }
  return data;
}

const auth = {
  hasToken: () => typeof window !== "undefined",
  async me() {
    const result = await request("/api/v1/auth/me");
    return result.user;
  },
  async sessions() { return request("/api/v1/auth/sessions"); },
  async revokeSession(sessionId) {
    return request("/api/v1/auth/sessions/" + encodeURIComponent(sessionId), { method: "DELETE", body: {} });
  },
  async changePassword({ current_password, new_password, mfa_code }) {
    return request("/api/v1/auth/password/change", {
      method: "POST",
      body: { current_password, new_password, ...(mfa_code ? { mfa_code } : {}) },
    });
  },
  async mfaStatus() { return request("/api/v1/auth/mfa/status"); },
  async mfaEnroll() { return request("/api/v1/auth/mfa/enroll", { method: "POST", body: {} }); },
  async mfaConfirm(code) { return request("/api/v1/auth/mfa/confirm", { method: "POST", body: { code } }); },
  async mfaDisable(code) { return request("/api/v1/auth/mfa/disable", { method: "POST", body: { code } }); },
  async register({ email, password, display_name }) {
    const result = await request("/api/v1/auth/register", { method: "POST", body: { email, password, display_name } });
    return { ...result, development_verification_code: result.development_verification_token };
  },
  async verifyOtp({ email, otpCode }) {
    return request("/api/v1/auth/verify-email", { method: "POST", body: { email, token: otpCode } });
  },
  async resendOtp(email) {
    const result = await request("/api/v1/auth/resend-verification", { method: "POST", body: { email } });
    return { ...result, development_verification_code: result.development_verification_token };
  },
  async resetPasswordRequest(email) {
    return request("/api/v1/auth/password/forgot", { method: "POST", body: { email } });
  },
  async resetPassword({ resetToken, newPassword }) {
    return request("/api/v1/auth/password/reset", { method: "POST", body: { token: resetToken, password: newPassword } });
  },
  async logout() {
    await request("/api/v1/auth/logout", { method: "POST", body: {} });
    if (typeof window !== "undefined") window.location.assign("/");
  },
  redirectToLogin(returnTo = "/") {
    if (typeof window !== "undefined") {
      window.location.assign("/login?returnTo=" + encodeURIComponent(returnTo));
    }
  },
  setToken() {
    // Authentication uses an HttpOnly session cookie; JavaScript never handles session tokens.
  },
  async loginWithProvider() {
    throw new Error("Social sign-in is not configured on the self-hosted backend yet.");
  },
};

async function invoke(name, payload = {}) {
  if (name === "usage") {
    const summary = await request("/api/v1/usage/summary");
    if (payload.action === "summary") return summary;
    if (payload.action === "events") {
      const events = await request("/api/v1/usage/events");
      return { ...summary, ...events };
    }
  }
  if (name === "provider-connections") {
    if (payload.action === "list") return request("/api/v1/providers");
    const providerCode = ["openai", "groq"].includes(payload.provider_code) ? payload.provider_code : "openai";
    if (payload.action === "connect") {
      return request("/api/v1/providers/" + providerCode, { method: "POST", body: { api_key: payload.credential } });
    }
    if (payload.action === "test") {
      return request("/api/v1/providers/" + providerCode + "/test", { method: "POST", body: {} });
    }
    if (payload.action === "revoke") {
      return request("/api/v1/providers/" + providerCode, { method: "DELETE", body: {} });
    }
    if (payload.action === "models") {
      const connections = await request("/api/v1/providers");
      const active = (connections.connections || []).filter((item) => item.status === "active" && ["openai", "groq"].includes(item.provider_code));
      const results = await Promise.all(active.map(async (item) => {
        const result = await request("/api/v1/providers/" + item.provider_code + "/models");
        return result.models || [];
      }));
      return { models: results.flat() };
    }
  }
  if (name === "api-keys") {
    if (payload.action === "list") {
      const result = await request("/api/v1/api-keys");
      return { keys: result.keys.map((key) => ({
        ...key,
        status: key.revoked_at ? "revoked" : key.expires_at && Date.parse(key.expires_at) <= Date.now() ? "expired" : "active",
        created_date: key.created_at,
      })) };
    }
    if (payload.action === "create") {
      const days = Number(payload.expires_in_days || 90);
      const expires_at = new Date(Date.now() + days * 86_400_000).toISOString();
      const result = await request("/api/v1/api-keys", { method: "POST", body: { name: payload.name, expires_at } });
      return { ...result, key: result.secret };
    }
    if (payload.action === "revoke") {
      return request("/api/v1/api-keys/" + encodeURIComponent(payload.key_id), { method: "DELETE", body: {} });
    }
  }
  throw new Error("Unsupported backend operation: " + name + "/" + payload.action);
}

const workspace = {
  async listChats() { return request("/api/v1/workspace/chats"); },
  async createChat({ title, model_id } = {}) {
    return request("/api/v1/workspace/chats", { method: "POST", body: { title, ...(model_id ? { model_id } : {}) } });
  },
  async getChat(sessionId) {
    return request("/api/v1/workspace/chats/" + encodeURIComponent(sessionId));
  },
  async renameChat(sessionId, title) {
    return request("/api/v1/workspace/chats/" + encodeURIComponent(sessionId), { method: "PATCH", body: { title } });
  },
  async deleteChat(sessionId) {
    return request("/api/v1/workspace/chats/" + encodeURIComponent(sessionId), { method: "DELETE", body: {} });
  },
  async streamChat({ model, messages, session_id, persist_user_message = true, persist_conversation = true, max_tokens, temperature, top_p, signal, onDelta, onUsage }) {
    const startedAt = performance.now();
    let firstTokenAt = null;
    let outputCharacters = 0;
    let usage = null;
    const response = await fetch("/api/v1/workspace/chat/completions", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify({
        model, messages, stream: true, persist_user_message, persist_conversation,
        ...(session_id ? { session_id } : {}),
        ...(max_tokens !== undefined ? { max_tokens } : {}),
        ...(temperature !== undefined ? { temperature } : {}),
        ...(top_p !== undefined ? { top_p } : {}),
      }),
      signal,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const error = new Error(data.error?.message || data.error?.code || "Chat request failed");
      error.status = response.status;
      error.code = data.error?.code;
      throw error;
    }
    if (!response.body) throw new Error("Streaming is not available in this browser.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = "";
    let finished = false;
    const processLine = (line) => {
      if (!line.startsWith("data:")) return;
      const value = line.slice(5).trim();
      if (!value || value === "[DONE]") { if (value === "[DONE]") finished = true; return; }
      let event;
      try { event = JSON.parse(value); } catch { return; }
      if (event.error) {
        const error = new Error(event.error.message || "The provider stream failed.");
        error.code = event.error.code;
        throw error;
      }
      const providerUsage = event.usage || event.x_groq?.usage;
      if (providerUsage) {
        usage = providerUsage;
        onUsage?.(usage);
      }
      const delta = event.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta.length) {
        if (firstTokenAt === null) firstTokenAt = performance.now();
        outputCharacters += delta.length;
        onDelta?.(delta);
      }
    };
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        const lines = pending.split(/\r?\n/);
        pending = lines.pop() || "";
        for (const line of lines) processLine(line);
      }
      pending += decoder.decode();
      if (pending) processLine(pending);
    } catch (error) {
      await reader.cancel().catch(() => {});
      throw error;
    }
    const finishedAt = performance.now();
    return {
      requestId: response.headers.get("x-request-id"),
      sessionId: response.headers.get("x-chat-session-id"),
      usage,
      ttftMs: firstTokenAt === null ? null : Math.round(firstTokenAt - startedAt),
      elapsedMs: Math.round(finishedAt - startedAt),
      outputCharacters,
      estimatedOutputTokens: Math.ceil(outputCharacters / 4),
      finished,
    };
  },
};

export const api = {
  auth,
  workspace,
  functions: { invoke },
};
