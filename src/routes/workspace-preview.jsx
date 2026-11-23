import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const PreviewDashboard = lazy(() =>
  import("./_authed/dashboard").then(({ PreviewDashboard: Component }) => ({ default: Component })),
);

function WorkspacePreviewPage() {
  return (
    <Suspense fallback={<div role="status" aria-label="Loading workspace preview" />}>
      <PreviewDashboard />
    </Suspense>
  );
}

export const Route = createFileRoute("/workspace-preview")({
  head: () => ({
    meta: [
      { title: "Aevotron — Workspace preview" },
      { name: "description", content: "Read-only visual preview of the Aevotron workspace." },
    ],
  }),
  component: WorkspacePreviewPage,
});
