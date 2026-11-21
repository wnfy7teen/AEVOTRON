// Base44 runtime configuration has been retired from the self-hosted application.
// The frontend talks to the same-origin /api/v1 endpoints through HttpOnly cookies.
export function getAppParams() {
  return { appId: null, token: null, functionsVersion: null, appBaseUrl: null };
}
