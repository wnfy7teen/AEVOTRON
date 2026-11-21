import { createFileRoute } from "@tanstack/react-router";
import { PreviewDashboard } from "./_authed/dashboard";

export const Route = createFileRoute("/workspace-preview")({
  head: () => ({
    meta: [
      { title: "Aevotron — Workspace preview" },
      { name: "description", content: "Read-only visual preview of the Aevotron workspace." },
    ],
  }),
  component: PreviewDashboard,
});
