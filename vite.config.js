import { readFileSync } from "node:fs";
import base44 from "@base44/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Bundle runtime dependencies consistently for the browser and SSR server.
// React and the TanStack Start/Router framework are handled by their own plugins.
const NOT_PREBUNDLED = new Set(["react", "react-dom", "@base44/vite-plugin", "@tanstack/react-start", "@tanstack/react-router", "@tanstack/react-router-ssr-query", "tailwindcss-animate"]);
const { dependencies } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
// The SDK's realtime transports: not direct dependencies, but app code importing one would otherwise be a new one.
const SDK_TRANSPORTS = ["partysocket", "socket.io-client"];
const PREBUNDLE = [...Object.keys(dependencies).filter((name) => !NOT_PREBUNDLED.has(name)), ...SDK_TRANSPORTS];
// In dev the browser otherwise fetches the router as ~100 separate files after the load event, delaying hydration
// by seconds behind the preview proxy. Browser only, and every browser entry point of the router, so one copy loads
// (templates/tests/tanstack-dev-router checks it).
const BROWSER_PREBUNDLE = [
  "@tanstack/react-router", "@tanstack/react-router/ssr/client", "@tanstack/router-core", "@tanstack/router-core/isServer",
  "@tanstack/router-core/ssr/client",
  "@tanstack/router-core/scroll-restoration-script", "@tanstack/history", "@tanstack/start-fn-stubs",
  "seroval", "seroval-plugins/web", "cookie-es",
];

export default defineConfig({
  optimizeDeps: { include: [...PREBUNDLE, ...BROWSER_PREBUNDLE] },
  environments: {
    ssr: {
      optimizeDeps: { include: PREBUNDLE },
      // Keep server source maps available for actionable runtime stack traces,
      // without embedding source contents in the generated maps.
      build: { sourcemap: true, rolldownOptions: { output: { sourcemapExcludeSources: true } } },
    },
  },
  plugins: [
    base44({
      hmrNotifier: true,
      navigationNotifier: true,
      // This is a public landing page; anonymous visitors must not trigger the
      // platform's authenticated app-usage logging endpoint.
      analyticsTracker: false,
      visualEditAgent: true,
    }),
    tanstackStart({ srcDirectory: "src" }),
    nitro(),
    react(),
  ],
});
