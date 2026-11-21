import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { normalizeLanguage } from "@/i18n";

function readCookie(cookieHeader, name) {
  const prefix = `${name}=`;
  const entry = (cookieHeader || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  if (!entry) return null;
  try { return decodeURIComponent(entry.slice(prefix.length)); } catch { return null; }
}

function negotiateLanguage(header) {
  return (header || "").split(",").map((part, index) => {
    const [tag, ...params] = part.trim().split(";");
    const quality = Number(params.find((param) => param.trim().startsWith("q="))?.trim().slice(2) ?? 1);
    return { tag, quality: Number.isFinite(quality) ? quality : 0, index };
  }).filter((item) => item.tag && item.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index)
    .map((item) => normalizeLanguage(item.tag))
    .find(Boolean) || "en";
}

export const getRequestLocale = createServerFn({ method: "GET" }).handler(() => {
  const cookieLocale = readCookie(getRequestHeader("cookie"), "aevotron-language");
  if (cookieLocale) return normalizeLanguage(cookieLocale);
  return negotiateLanguage(getRequestHeader("accept-language"));
});
