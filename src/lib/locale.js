export const supportedLocales = ["en", "ru", "zh"];

function normalizeSupportedLocale(value) {
  const base = String(value || "").toLowerCase().split(/[-_]/)[0];
  return supportedLocales.includes(base) ? base : null;
}

export function readLocaleCookie(cookieHeader, name = "aevotron-language") {
  const prefix = `${name}=`;
  const entry = String(cookieHeader || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  if (!entry) return null;
  try { return decodeURIComponent(entry.slice(prefix.length)); } catch { return null; }
}

export function negotiateAcceptLanguage(header) {
  const preferences = String(header || "").split(",").map((part, index) => {
    const [tag, ...params] = part.trim().split(";");
    const qualityParam = params.map((param) => param.trim()).find((param) => /^q\s*=/i.test(param));
    const qualityValue = qualityParam?.match(/^q\s*=\s*(.*)$/i)?.[1];
    const quality = qualityParam ? Number(qualityValue) : 1;
    const validQuality = Number.isFinite(quality) && quality >= 0 && quality <= 1 ? quality : 0;
    return { locale: normalizeSupportedLocale(tag), quality: validQuality, index };
  }).filter((item) => item.locale && item.quality > 0);
  preferences.sort((a, b) => b.quality - a.quality || a.index - b.index);
  return preferences[0]?.locale || "en";
}

export function resolveRequestLocale(cookieHeader, acceptLanguageHeader) {
  return normalizeSupportedLocale(readLocaleCookie(cookieHeader)) || negotiateAcceptLanguage(acceptLanguageHeader);
}
