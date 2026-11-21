import { translateForLanguage } from "@/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/components/auth/LoginPage";
export const Route = createFileRoute("/login")({
  ssr: false,
  head: ({ matches }) => { const locale = matches.find((match) => match.routeId === "__root__")?.loaderData || "en"; return { meta: [{ title: translateForLanguage(locale, "Sign in — Aevotron") }] }; },
  component: LoginPage,
});