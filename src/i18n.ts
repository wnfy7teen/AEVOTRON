import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ru from "./locales/ru.json";
import zh from "./locales/zh.json";

export const LANGUAGE_STORAGE_KEY = "aevotron-language";
export const supportedLanguages = ["en", "ru", "zh"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

const resources = {
  en: { translation: en },
  ru: { translation: ru },
  zh: { translation: zh },
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

export function createAppI18n(storage?: Pick<Storage, "getItem" | "setItem"> | null) {
  const instance = createInstance();
  instance.use(initReactI18next).init({
    resources,
    lng: readSavedLanguage(storage),
    fallbackLng: "en",
    supportedLngs: [...supportedLanguages],
    nonExplicitSupportedLngs: true,
    load: "languageOnly",
    defaultNS: "translation",
    ns: ["translation"],
    keySeparator: false,
    interpolation: { escapeValue: false },
    returnEmptyString: false,
    react: { useSuspense: false },
    initImmediate: false,
  });

  instance.on("languageChanged", (language) => {
    const normalized = normalizeLanguage(language);
    try {
      const target = storage ?? (typeof window !== "undefined" ? window.localStorage : null);
      target?.setItem(LANGUAGE_STORAGE_KEY, normalized);
    } catch {
      // Keep the active language for this session if storage is unavailable.
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = normalized === "zh" ? "zh-CN" : normalized;
    }
  });

  return instance;
}

const i18n = createAppI18n();
if (typeof document !== "undefined") {
  const language = normalizeLanguage(i18n.resolvedLanguage || i18n.language);
  document.documentElement.lang = language === "zh" ? "zh-CN" : language;
}

export default i18n;
