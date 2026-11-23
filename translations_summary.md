# AEVOTRON — i18next migration and localization QA

**Branch:** `infra/cloudflare-workers-preview`  
**Languages:** English (`en`), Russian (`ru`), Simplified Chinese (`zh`)  
**Architecture:** `i18next` + `react-i18next`  
**Language persistence:** `localStorage["aevotron-language"]`  
**Fallback:** English (`en`)

## Architecture delivered

| File | Responsibility |
|---|---|
| `src/i18n.ts` | Creates the i18next instance, configures the three supported languages, English fallback, language normalization, localStorage persistence and document metadata |
| `src/locales/en.json` | Canonical English translation catalog |
| `src/locales/ru.json` | Russian translation catalog with the same keys as English |
| `src/locales/zh.json` | Simplified Chinese translation catalog with the same keys as English |
| `src/lib/i18n.jsx` | React provider, compatibility hook backed by `useTranslation`, and Apple-style language dropdown |
| `src/lib/ThemeSwitcher.jsx` | Localized theme-switcher labels and accessibility names |
| `vitest.config.js` | Vitest + jsdom configuration |
| `tests/i18n.test.jsx` | Language-change rerender, localStorage persistence/reload and English fallback tests |
| `tests/translations.test.js` | Node regression tests for catalog synchronization and app-level i18next wiring |

The previous hand-written dictionary implementation and body-wide DOM text-rewriting observer were removed. React UI text is rendered through i18next translation calls; document title, description and the root `lang` attribute are synchronized separately.

## Application coverage

| Page / component area | Translation status | Keys filled |
|---|---|---|
| Landing page `/` | Ready | Yes |
| Sign in `/login` | Ready | Yes |
| Registration `/register` | Ready | Yes |
| Forgot password `/forgot-password` | Ready | Yes |
| Reset password `/reset-password` | Ready | Yes |
| Email verification `/verify-email` | Ready | Yes |
| MFA `/mfa` | Ready | Yes |
| Workspace dashboard `/dashboard` | Ready | Yes |
| Read-only workspace preview `/workspace-preview` | Ready | Yes |
| Shared dialogs, sheets, pagination, carousel, sidebar, breadcrumb and auth controls | Ready | Yes |
| Theme and language switchers, 404 and error screens | Ready | Yes |

## Catalog integrity

All three JSON files use the same flat key structure. The test suite verifies exact key-set equality, non-empty string values and required labels for authentication, MFA, Billing, Transactions, Team, Usage, Notifications, API keys and shared accessibility controls.

**Catalog size:** 766 keys in each language (2,298 localized values total). The Node regression test checks that all three key sets are identical and every value is a non-empty string.

## Automated tests

The package test command now runs both suites. The last successful CI run executed 45 Node regression tests, 3 Vitest i18n tests and 11 backend security tests; ESLint and both production/Cloudflare builds also passed.



```bash
npm test
```

Equivalent focused commands:

```bash
npm run test:node
npm run test:i18n
```

Vitest checks that a rendered React component updates immediately when i18next changes language, that the selected language is written to localStorage and restored by a fresh i18n instance, and that unsupported saved language values fall back to English.

## Manual browser QA still required

Static source checks and automated tests do not replace visual verification. On the Preview deployment, verify the nine routes in each language (27 route/language combinations), including narrow mobile widths. Check line wrapping, dropdowns, long Chinese labels, auth validation messages, keyboard focus, accessibility labels, document titles and persistence after a hard refresh.

Backend-generated error text that is not a known catalog key can still be returned in its original language. For complete localization of external API errors, map stable backend error codes to frontend translation keys rather than translating arbitrary server prose.

**Deployment:** no production deployment was performed. A successful CI build is required before considering the Preview change validated; visual browser QA remains a separate release check.
