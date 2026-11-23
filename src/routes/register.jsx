import { translateForLanguage } from "@/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { RegisterPage } from "@/components/auth/RegisterPage";
export const Route = createFileRoute("/register")({
  ssr: false,
  head: ({ matches }) => { const locale = matches.find((match) => match.routeId === "__root__")?.loaderData || "en"; return { meta: [{ title: translateForLanguage(locale, "Create account — Aevotron") }] }; },
  component: RegisterPage,
});