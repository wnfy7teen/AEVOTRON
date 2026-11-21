import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Keep this adapter isolated from vite.config.js so existing Vercel and Docker
// builds continue using Nitro until the Cloudflare preview is fully verified.
const NOT_PREBUNDLED = new Set([
  "react",
  "react-dom",
  "@tanstack/react-start",
  "@tanstack/react-router",
  "@tanstack/react-router-ssr-query",
  "tailwindcss-animate",
]);
const { dependencies } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
);
const SDK_TRANSPORTS = ["partysocket", "socket.io-client"];
const PREBUNDLE = [
  ...Object.keys(dependencies).filter((name) => !NOT_PREBUNDLED.has(name)),
  ...SDK_TRANSPORTS,
];

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  optimizeDeps: { include: PREBUNDLE },
  environments: {
    ssr: {
      optimizeDeps: { include: PREBUNDLE },
      build: {
        sourcemap: true,
        rolldownOptions: { output: { sourcemapExcludeSources: true } },
      },
    },
  },
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tanstackStart({ srcDirectory: "src" }),
    react(),
  ],
});
