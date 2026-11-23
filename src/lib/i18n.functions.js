import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { resolveRequestLocale } from "@/lib/locale";

export const getRequestLocale = createServerFn({ method: "GET" }).handler(() => (
  resolveRequestLocale(
    getRequestHeader("cookie"),
    getRequestHeader("accept-language"),
  )
));
