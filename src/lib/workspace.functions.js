import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { toPublicWorkspace, validateWorkspaceInput } from "@/lib/workspace.validation";

export const getOrCreateMyWorkspace = createServerFn({ method: "POST" })
  .validator(validateWorkspaceInput)
  .handler(async () => {
    const request = getRequest();
    const origin = process.env.API_INTERNAL_URL || new URL(request.url).origin;
    const response = await fetch(new URL("/api/v1/workspaces/current", origin), {
      headers: { cookie: request.headers.get("cookie") || "" },
      signal: AbortSignal.timeout(10_000),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(result.error?.message || "Workspace could not be loaded.");
      error.status = response.status;
      throw error;
    }
    return toPublicWorkspace(result.workspace);
  });
