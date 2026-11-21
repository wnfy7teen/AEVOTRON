import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("authentication and consent UI strings are translated into Russian and Chinese", async () => {
  const i18n = await read("src/lib/i18n.jsx");
  const start = i18n.indexOf("const dictionaries = {");
  const landingStart = i18n.indexOf("const landingTranslations = {", start);
  assert.notEqual(start, -1);
  assert.notEqual(landingStart, -1);
  const dictionaries = i18n.slice(start, landingStart);
  const ruStart = dictionaries.indexOf("ru: {");
  const zhStart = dictionaries.indexOf("zh: {");
  const ru = dictionaries.slice(ruStart, zhStart);
  const zh = dictionaries.slice(zhStart);
  const required = ["Try again","Could not load this authorization request. Please try again.","This authorization can no longer be completed. Reconnect from your AI client to try again.","Could not complete authorization. Please try again.","No tools requested","Show all","Agents","Actions","An AI client","this app","Verify via Text Message","Verify via Authenticator App","Add a second sign-in step to keep your account secure. Choose how you want to get your codes.","Verify with a code sent to your phone","Enter the 6-digit code","Continue with SSO","Ask the app owner for an invitation, or sign in with a different account.","Sign out","Access not granted","Your account is not registered for this app.","Unable to sign in with Google","Invalid phone number. Please check the number and try again.","Resend in","A 6-digit code sent to","View, create and delete records","Sending code to","Enter the code sent to","Continue with","is already verified. Sign in to continue.","Copied","or","Verification failed. Please try again.","This authorization link is invalid or has expired.","Access granted","Access denied","You can return to","wants to access","on your behalf","and close this window.","Data","This app","requires multi-factor authentication","Authenticator app","Use an app like Google Authenticator or Duo to generate secure sign-in codes.","Text messages","Get sign-in codes sent to your phone by text message.","Add an extra layer of protection when signing in. You'll be asked for a code each time you sign in.","We'll send you a link to reset it","your phone","QR code for authenticator app setup","Invalid email or password","Code sent","Check your email for the new code.","Failed to reset password","Failed to resend","Invalid code"];
  const missing = required.filter((key) => !ru.includes(`${JSON.stringify(key)}:`) || !zh.includes(`${JSON.stringify(key)}:`));
  assert.deepEqual(missing, [], "all auth/consent strings must have both translations");
});
