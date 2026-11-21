// Local, privacy-conscious error reporting. Do not send prompts, credentials, cookies,
// request bodies, or user data to an external platform.
function record(error, context = {}) {
  const name = typeof error?.name === "string" ? error.name.slice(0, 80) : "Error";
  const route = typeof context.route === "string" ? context.route.slice(0, 120) : undefined;
  const fn = typeof context.fn === "string" ? context.fn.slice(0, 120) : undefined;
  console.error("[aevotron]", JSON.stringify({ name, route, fn, at: new Date().toISOString() }));
}

export const recordFunctionError = (error, serverFnMeta) =>
  record(error, { fn: serverFnMeta?.name ?? serverFnMeta?.id });

export const recordRequestError = (_request, error) => record(error);

export const recordRouteError = (_request, error, route) => record(error, { route });

export const recordErrorResponse = (_request, result) => {
  if (result?.response?.status >= 500) record(new Error("Server route returned a 5xx response"));
};
