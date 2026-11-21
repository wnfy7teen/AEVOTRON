import { createFileRoute } from "@tanstack/react-router";
import AppleLanding from "@/components/landing/AppleLanding";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AEVOTRON — Все модели. Один API." },
      {
        name: "description",
        content: "Единый API для подключения AI-моделей разных провайдеров.",
      },
    ],
  }),
  component: AppleLanding,
});
