import { createFileRoute } from "@tanstack/react-router";

async function proxyChatCompletion({ request }) {
  const baseUrl = process.env.API_INTERNAL_URL || process.env.AEVOTRON_API_URL;
  if (!baseUrl) {
    return Response.json(
      { error: { code: "API_NOT_CONFIGURED", message: "The self-hosted API origin is not configured." } },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  const incoming = new URL(request.url);
  const target = new URL("/v1/chat/completions", baseUrl);
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");
  headers.set("x-forwarded-host", incoming.host);
  headers.set("x-forwarded-proto", incoming.protocol.slice(0, -1));
  try {
    const upstream = await fetch(target, {
      method: "POST",
      headers,
      body: await request.arrayBuffer(),
      redirect: "manual",
      signal: AbortSignal.timeout(65_000),
    });
    const responseHeaders = new Headers(upstream.headers);
    for (const name of ["connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailers", "transfer-encoding", "upgrade"]) responseHeaders.delete(name);
    responseHeaders.set("cache-control", "no-store");
    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders });
  } catch {
    return Response.json({ error: { code: "API_UNAVAILABLE", message: "The self-hosted API is temporarily unavailable." } }, { status: 502 });
  }
}

export const Route = createFileRoute("/v1/chat/completions")({
  server: { handlers: { POST: proxyChatCompletion } },
});
