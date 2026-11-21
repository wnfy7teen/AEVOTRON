import { translateForLanguage } from "@/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { MfaPage } from "@/components/auth/MfaPage";
export const Route = createFileRoute("/mfa")({
  ssr: false,
  head: ({ matches }) => { const locale = matches.find((match) => match.routeId === "__root__")?.loaderData || "en"; return { meta: [{ title: translateForLanguage(locale, "Two-factor authentication — Aevotron") }] }; },
  component: MfaPage,
});