import { translateForLanguage } from "@/i18n";
import { createFileRoute } from "@tanstack/react-router";
import AppleLanding from "@/components/landing/AppleLanding";

export const Route = createFileRoute("/")({
  head: ({ matches }) => { const locale = matches.find((match) => match.routeId === "__root__")?.loaderData || "en"; return { meta: [{ title: translateForLanguage(locale, "AEVOTRON — Все модели. Один API.") }, { name: "description", content: translateForLanguage(locale, "Единый API для подключения AI-моделей разных провайдеров.") }] }; },
  component: AppleLanding,
});
