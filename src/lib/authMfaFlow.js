async function request(path, { method = "POST", body } = {}) {
  const response = await fetch("/api/v1/auth/" + path, {
    method,
    credentials: "include",
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new MfaError(result.error?.message || "Something went wrong. Try again.", response.status);
    error.code = result.error?.code;
    throw error;
  }
  return result;
}

export class MfaError extends Error {
  constructor(message, status, retryAfter) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
  get mustSignInAgain() {
    return this.status === 401;
  }
}

export function mfaSession(challenge = {}) {
  const challengeToken = challenge.mfa_challenge_token;
  return {
    verify: (code) => request("mfa/verify-login", { body: { challenge_token: challengeToken, code } }),
    sendSignInCode: async () => { throw new Error("SMS verification is not enabled yet."); },
    setupAuthenticator: () => request("mfa/enroll", { body: {} }),
    confirmAuthenticator: (code) => request("mfa/confirm", { body: { code } }),
    sendPhoneCode: async () => { throw new Error("SMS verification is not enabled yet."); },
    confirmPhone: async () => { throw new Error("SMS verification is not enabled yet."); },
    status: () => request("mfa/status", { method: "GET" }),
    sendProofCode: async () => { throw new Error("SMS verification is not enabled yet."); },
    removeMethod: (method, code) => method === "totp"
      ? request("mfa/disable", { body: { code } })
      : Promise.reject(new Error("SMS verification is not enabled yet.")),
    forgetDevices: async () => ({ success: true }),
  };
}

export async function resumeMfa() {
  return null;
}

export function finishSignIn(_unusedToken, returnTo = "/dashboard") {
  if (typeof window !== "undefined") window.location.assign(returnTo || "/dashboard");
}

export async function signInToManageMfa(email, password) {
  const response = await fetch("/api/v1/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 202) throw new Error(result.error?.message || "Unable to sign in.");
  return result.mfa_required ? {
    mfa_required: true, next_step: "verify", mfa_methods: ["totp"], mfa_challenge_token: result.mfa_challenge_token,
  } : result;
}

export async function signInWithProvider() {
  throw new Error("Social sign-in is not configured on the self-hosted backend yet.");
}
