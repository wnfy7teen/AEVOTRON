import { createInstance, type i18n as I18nInstance } from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ru from "./locales/ru.json";
import zh from "./locales/zh.json";
import dashboardEn from "./locales/dashboard/en.json";
import dashboardRu from "./locales/dashboard/ru.json";
import dashboardZh from "./locales/dashboard/zh.json";
import landingEn from "./locales/landing/en.json";
import landingRu from "./locales/landing/ru.json";
import landingZh from "./locales/landing/zh.json";

export const LANGUAGE_STORAGE_KEY = "aevotron-language";
export const LANGUAGE_COOKIE_KEY = "aevotron-language";
export const supportedLanguages = ["en", "ru", "zh"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

const resources = {
  en: { translation: en, dashboard: dashboardEn, landing: landingEn },
  ru: { translation: ru, dashboard: dashboardRu, landing: landingRu },
  zh: { translation: zh, dashboard: dashboardZh, landing: landingZh },
};

export function normalizeLanguage(value: string | null | undefined): SupportedLanguage {
  const language = (value || "").toLowerCase().split(/[-_]/)[0];
  return supportedLanguages.includes(language as SupportedLanguage) ? language as SupportedLanguage : "en";
}

export function readSavedLanguage(storage?: Pick<Storage, "getItem"> | null): SupportedLanguage {
  try {
    const target = storage ?? (typeof window !== "undefined" ? window.localStorage : null);
    return normalizeLanguage(target?.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return "en";
  }
}

type I18nOptions = {
  language?: string | null;
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
};

export function createAppI18n(options: I18nOptions | Pick<Storage, "getItem" | "setItem"> | null = {}): I18nInstance {
  const normalizedOptions = options && "getItem" in options
    ? { storage: options as Pick<Storage, "getItem" | "setItem"> }
    : (options || {}) as I18nOptions;
  const { language, storage } = normalizedOptions;
  const instance = createInstance();
  instance.use(initReactI18next).init({
    resources,
    lng: language ? normalizeLanguage(language) : readSavedLanguage(storage),
    fallbackLng: "en",
    supportedLngs: [...supportedLanguages],
    nonExplicitSupportedLngs: true,
    load: "languageOnly",
    defaultNS: "translation",
    ns: ["translation", "dashboard", "landing"],
    fallbackNS: "translation",
    keySeparator: false,
    interpolation: { escapeValue: false },
    returnEmptyString: false,
    returnNull: false,
    react: { useSuspense: false },
    initImmediate: false,
  });

  instance.on("languageChanged", (nextLanguage) => {
    const normalized = normalizeLanguage(nextLanguage);
    try {
      const target = storage ?? (typeof window !== "undefined" ? window.localStorage : null);
      target?.setItem(LANGUAGE_STORAGE_KEY, normalized);
    } catch {
      // Storage is optional; the active in-memory locale remains valid.
    }
    persistLanguageCookie(normalized);
    if (typeof document !== "undefined") {
      document.documentElement.lang = normalized === "zh" ? "zh-CN" : normalized;
    }
  });

  return instance;
}

export function persistLanguageCookie(language: string) {
  if (typeof document === "undefined") return;
  const normalized = normalizeLanguage(language);
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${LANGUAGE_COOKIE_KEY}=${encodeURIComponent(normalized)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

export function translateForLanguage(language: string | null | undefined, key: string) {
  const locale = normalizeLanguage(language);
  const catalog = resources[locale].translation as Record<string, string>;
  const fallback = resources.en.translation as Record<string, string>;
  return catalog[key] ?? fallback[key] ?? key;
}
