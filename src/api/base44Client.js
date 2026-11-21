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
    if (payload.action === "connect") {
      return request("/api/v1/providers/openai", { method: "POST", body: { api_key: payload.credential } });
    }
    if (payload.action === "test") {
      return request("/api/v1/providers/openai/test", { method: "POST", body: { connection_id: payload.connection_id } });
    }
    if (payload.action === "revoke") return request("/api/v1/providers/openai", { method: "DELETE", body: {} });
    if (payload.action === "models") return request("/api/v1/providers/openai/models");
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

export const base44 = {
  auth,
  functions: { invoke },
};
