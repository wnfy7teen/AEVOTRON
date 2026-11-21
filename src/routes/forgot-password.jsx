import { translateForLanguage } from "@/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { ForgotPasswordPage } from "@/components/auth/ForgotPasswordPage";
export const Route = createFileRoute("/forgot-password")({
  ssr: false,
  head: ({ matches }) => { const locale = matches.find((match) => match.routeId === "__root__")?.loaderData || "en"; return { meta: [{ title: translateForLanguage(locale, "Reset password — Aevotron") }] }; },
  component: ForgotPasswordPage,
});