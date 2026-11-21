import { createMiddleware } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";

// Browser-facing authentication is handled by the standalone API's HttpOnly session cookie.
export const authMiddleware = createMiddleware({ type: "function" }).server(({ next }) => next());
export const base44RequestMiddleware = createMiddleware({ type: "request" }).server(({ next }) => next());

export const requireUser = createMiddleware({ type: "function" }).server(async ({ next }) => {
  setResponseStatus(501);
  throw Object.assign(new Error("Use the self-hosted /api/v1 session API for authenticated operations."), {
    status: 501,
    code: "SELF_HOSTED_API_REQUIRED",
  });
});

export const requireUserRoute = createMiddleware({ type: "request" }).server(async () =>
  Response.json({ error: "Use the self-hosted /api/v1 session API." }, { status: 501 }),
);
