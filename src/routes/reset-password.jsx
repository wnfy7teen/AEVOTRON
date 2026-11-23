import { translateForLanguage } from "@/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { ResetPasswordPage } from "@/components/auth/ResetPasswordPage";
export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: ({ matches }) => { const locale = matches.find((match) => match.routeId === "__root__")?.loaderData || "en"; return { meta: [{ title: translateForLanguage(locale, "Choose a new password — Aevotron") }] }; },
  component: ResetPasswordPage,
});