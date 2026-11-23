# Orbital badge design notes

## Component

The landing-page orbital graphic is implemented in `src/components/landing/OrbitalBadge.tsx` and styled by `src/components/landing/hero-orbit.css`.

- The central badge is a fixed 120 × 120 px circle, reduced to 96 × 96 px at widths up to 640 px.
- The monogram `A` is a brand mark and intentionally remains unchanged between languages.
- The orbit labels travel around the center using CSS transforms only. Their inner spans counter-rotate so the copy remains upright.
- Hovering the graphic pauses the label animation. The existing IntersectionObserver / document visibility handling also pauses it when it is off-screen or the tab is hidden.
- Theme colors come from the shared semantic tokens, so Light and Gray/Dark themes do not need separate hard-coded color rules.
- Reduced-motion preferences disable the orbit animation.

## Translation keys

The component uses the flat i18next keys below. The same values are kept in both the root catalogs (`src/locales/{ru,en,zh}.json`) and landing namespace catalogs (`src/locales/landing/{ru,en,zh}.json`).

| Key | RU | EN | ZH |
|---|---|---|---|
| `core.aevotron` | AEVOTRON | AEVOTRON | AEVOTRON |
| `core.unified_api` | ЕДИНЫЙ API | UNIFIED API | 统一 API |
| `orbit.top` | ЕДИНЫЙ ИНТЕРФЕЙС | ONE INTERFACE | 统一接口 |
| `orbit.bottom` | НЕСКОЛЬКО МОДЕЛЕЙ | MULTIPLE MODELS | 多种模型 |
| `orbit.left` | SECURE KEYS | SECURE KEYS | SECURE KEYS |
| `orbit.right` | USAGE ANALYTICS | USAGE ANALYTICS | USAGE ANALYTICS |
| `orbit.top_right` | LOW LATENCY | LOW LATENCY | LOW LATENCY |
| `orbit.bottom_left` | SMART ROUTING | SMART ROUTING | SMART ROUTING |

Keep the English-only orbit labels marked with `data-no-translate="true"` to prevent browser translation extensions from rewriting the brand vocabulary. When adding a label, add the same key to all six locale catalogs and update the unit test.

## Demonstrating the animation

1. Start the app with `npm run dev`.
2. Open the landing page and scroll until the orbital badge is visible.
3. Observe the six labels orbiting the center while the inner text remains upright.
4. Hover the graphic to pause the motion; move the pointer away to resume.
5. Switch between RU, EN and ZH. The brand/API text and localized top/bottom labels should update without a page reload.
6. Toggle Light and Gray/Dark themes. The badge should inherit the active semantic tokens.
7. Enable the operating system's reduced-motion setting; the orbit labels should stop animating.

## Tests

- Unit: `npm run test:i18n -- tests/orbital-badge.test.tsx` (Vitest + jsdom; exercises the actual React component and live language switching).
- Browser integration: install Playwright with `npm install -D @playwright/test`, then install Chromium with `npx playwright install chromium`. Run `npx playwright test e2e/orbital-scroll.playwright.ts` with the dev server running. Set `BASE_URL` to test another deployment.
- The Playwright test records frame cadence and Long Task API entries while scrolling. A 60 Hz display cannot report materially more than 60 FPS, so the test uses a 55 FPS tolerance and fails on observed Long Tasks over 50 ms. Performance results remain hardware/browser dependent.
