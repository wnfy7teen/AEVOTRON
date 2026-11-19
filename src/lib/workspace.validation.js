export const validateWorkspaceInput = (input) => {
  const name = typeof input?.name === "string" ? input.name.trim() : "Personal workspace";

  if (!name || name.length > 80) {
    throw new Error("Workspace name must be between 1 and 80 characters.");
  }

  return { name };
};

export const toPublicWorkspace = (workspace) => ({
  id: workspace.id,
  name: workspace.name,
  region: workspace.region,
  status: workspace.status,
});
