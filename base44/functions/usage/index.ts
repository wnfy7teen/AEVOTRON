import { createClientFromRequest } from "npm:@base44/sdk";

const json = (data, status = 200) => Response.json(data, {
  status, headers: { "Cache-Control": "no-store" },
});
const now = () => new Date().toISOString();

async function ensureWorkspace(base44, user) {
  const entities = base44.asServiceRole.entities;
  const rows = await entities.Workspace.filter(
    { owner_user_id: user.id }, "-created_date", 1, 0, ["id", "owner_user_id", "status"],
  );
  let workspace = rows[0];
  if (!workspace) {
    workspace = await entities.Workspace.create({
      owner_user_id: user.id, name: "Personal workspace", region: "global", status: "active",
    });
  }
  const memberships = await entities.WorkspaceMember.filter(
    { workspace_id: workspace.id, user_id: user.id, status: "active" }, "-created_date", 1, 0, ["id"],
  );
  if (!memberships.length) {
    await entities.WorkspaceMember.create({
      workspace_id: workspace.id, owner_user_id: user.id, user_id: user.id, role: "owner", status: "active",
    });
  }
  return workspace;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: { code: "METHOD_NOT_ALLOWED" } }, 405);
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user?.id) return json({ error: { code: "UNAUTHORIZED" } }, 401);

    const input = await req.json().catch(() => ({}));
    if (input?.action !== "summary" && input?.action !== "events") {
      return json({ error: { code: "INVALID_ACTION" } }, 400);
    }

    const workspace = await ensureWorkspace(base44, user);
    const rows = await base44.asServiceRole.entities.UsageEvent.filter(
      { owner_user_id: user.id, workspace_id: workspace.id },
      "-created_date", 5000, 0,
      ["id", "request_id", "model_id", "provider_code", "input_tokens", "output_tokens",
        "latency_ms", "status_code", "error_code", "created_at"],
    );

    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = rows.filter((event) => {
      const timestamp = Date.parse(event.created_at || event.created_date || "");
      return Number.isFinite(timestamp) && timestamp >= cutoff;
    });
    const requests = recent.length;
    const tokens = recent.reduce((sum, event) =>
      sum + Number(event.input_tokens || 0) + Number(event.output_tokens || 0), 0);
    const latencies = recent.map((event) => Number(event.latency_ms || 0)).filter((value) => value > 0);
    const errors = recent.filter((event) => Number(event.status_code || 0) >= 400).length;
    const summary = {
      requests,
      tokens,
      average_latency_ms: latencies.length
        ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length)
        : null,
      error_rate: requests ? Math.round((errors / requests) * 1000) / 10 : 0,
      period: "30d",
      generated_at: now(),
    };

    const events = rows.slice(0, 50).map((event) => ({
      id: event.id,
      request_id: event.request_id,
      model_id: event.model_id || "—",
      provider_code: event.provider_code || "—",
      input_tokens: Number(event.input_tokens || 0),
      output_tokens: Number(event.output_tokens || 0),
      latency_ms: Number(event.latency_ms || 0),
      status_code: Number(event.status_code || 0),
      error_code: event.error_code || "",
      created_at: event.created_at || event.created_date || null,
    }));

    return json({ summary, events: input.action === "events" ? events : [] });
  } catch {
    return json({ error: { code: "INTERNAL_ERROR", message: "Usage data could not be loaded." } }, 500);
  }
});