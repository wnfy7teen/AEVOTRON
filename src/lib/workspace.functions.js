import { createServerFn } from "@tanstack/react-start";
import { requireUser } from "@/lib/auth-middleware";
import { toPublicWorkspace, validateWorkspaceInput } from "@/lib/workspace.validation";

/**
 * Returns the signed-in user's personal workspace, creating it on first use.
 * All writes use Base44 service role from the server; callers cannot supply owner IDs,
 * workspace IDs, roles, or membership status.
 */
export const getOrCreateMyWorkspace = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .validator(validateWorkspaceInput)
  .handler(async ({ data, context }) => {
    const userId = context.user.id;
    const entities = context.getBase44().asServiceRole.entities;

    const workspaces = await entities.Workspace.filter(
      { owner_user_id: userId },
      "-created_date",
      1,
      0,
      ["id", "owner_user_id", "name", "region", "status"],
    );

    let workspace = workspaces[0];

    if (!workspace) {
      workspace = await entities.Workspace.create({
        owner_user_id: userId,
        name: data.name,
        region: "global",
        status: "active",
      });
    }

    // Repair a missing owner membership if an earlier request failed between writes.
    const memberships = await entities.WorkspaceMember.filter(
      { workspace_id: workspace.id, user_id: userId, status: "active" },
      "-created_date",
      1,
      0,
      ["id", "workspace_id", "user_id", "status"],
    );

    if (memberships.length === 0) {
      await entities.WorkspaceMember.create({
        workspace_id: workspace.id,
        owner_user_id: userId,
        user_id: userId,
        role: "owner",
        status: "active",
      });
    }

    return toPublicWorkspace(workspace);
  });
