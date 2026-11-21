import { createFileRoute } from "@tanstack/react-router";
import { PreviewDashboard } from "./_authed/dashboard";

export const Route = createFileRoute("/workspace-preview")({
  head: () => ({
    meta: [
      { title: "Aevotron — Workspace preview" },
      { name: "description", content: "Read-only visual preview of the Aevotron workspace." },
    ],
  }),
  // Keep the imported dashboard component behind a route-local wrapper.
  // TanStack/Vite route splitting must not inline its private HomePage reference.
  component: () => <PreviewDashboard />,
});
