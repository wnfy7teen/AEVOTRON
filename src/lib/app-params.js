// Public app configuration is now same-origin; no platform-specific app ID or access token is required.
export function getAppParams() {
  return { appId: null, token: null, functionsVersion: null, appBaseUrl: null };
}
