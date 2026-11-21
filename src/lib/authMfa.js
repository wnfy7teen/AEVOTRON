export async function loginWithMfa(email, password) {
  const response = await fetch("/api/v1/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 202) {
    const error = new Error(result.error?.message || "Email or password is incorrect.");
    error.status = response.status;
    throw error;
  }
  if (result.mfa_required) {
    return {
      mfa_required: true,
      next_step: "verify",
      mfa_methods: ["totp"],
      mfa_challenge_token: result.mfa_challenge_token,
    };
  }
  return result;
}
