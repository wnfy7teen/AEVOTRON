import { createInstance, type i18n as I18nInstance, type Resource } from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ru from "./locales/ru.json";
import zh from "./locales/zh.json";

export const LANGUAGE_STORAGE_KEY = "aevotron-language";
export const LANGUAGE_COOKIE_KEY = "aevotron-language";
export const supportedLanguages = ["en", "ru", "zh"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];
export type LocaleNamespaces = {
  dashboard: Record<string, string>;
  landing: Record<string, string>;
  auth: Record<string, string>;
};

const translationResources = {
  en: { translation: en },
  ru: { translation: ru },
  zh: { translation: zh },
};

const namespaceLoaders: Record<SupportedLanguage, () => Promise<LocaleNamespaces>> = {
  en: async () => {
    const [dashboard, landing, auth] = await Promise.all([
      import("./locales/dashboard/en.json"),
      import("./locales/landing/en.json"),
      import("./locales/auth/en.json"),
    ]);
    return { dashboard: dashboard.default, landing: landing.default, auth: auth.default };
  },
  ru: async () => {
    const [dashboard, landing, auth] = await Promise.all([
      import("./locales/dashboard/ru.json"),
      import("./locales/landing/ru.json"),
      import("./locales/auth/ru.json"),
    ]);
    return { dashboard: dashboard.default, landing: landing.default, auth: auth.default };
  },
  zh: async () => {
    const [dashboard, landing, auth] = await Promise.all([
      import("./locales/dashboard/zh.json"),
      import("./locales/landing/zh.json"),
      import("./locales/auth/zh.json"),
    ]);
    return { dashboard: dashboard.default, landing: landing.default, auth: auth.default };
  },
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
  resources?: Partial<Record<SupportedLanguage, Partial<LocaleNamespaces>>>;
};

export async function loadLocaleResources(language: string): Promise<LocaleNamespaces> {
  return namespaceLoaders[normalizeLanguage(language)]();
}

export async function changeAppLanguage(instance: I18nInstance, language: string): Promise<void> {
  const nextLanguage = normalizeLanguage(language);
  const namespaces = ["dashboard", "landing", "auth"] as const;
  const missing = namespaces.some((namespace) => !instance.hasResourceBundle(nextLanguage, namespace));
  if (missing) {
    const loaded = await loadLocaleResources(nextLanguage);
    for (const namespace of namespaces) {
      if (!instance.hasResourceBundle(nextLanguage, namespace)) {
        instance.addResourceBundle(nextLanguage, namespace, loaded[namespace], true, true);
      }
    }
  }
  await instance.changeLanguage(nextLanguage);
}

export function createAppI18n(options: I18nOptions | Pick<Storage, "getItem" | "setItem"> | null = {}): I18nInstance {
  const normalizedOptions = options && "getItem" in options
    ? { storage: options as Pick<Storage, "getItem" | "setItem"> }
    : (options || {}) as I18nOptions;
  const { language, storage, resources: initialResources } = normalizedOptions;
  const resources = Object.fromEntries(
    supportedLanguages.map((locale) => [
      locale,
      { ...translationResources[locale], ...(initialResources?.[locale] || {}) },
    ]),
  ) as Resource;
  const instance = createInstance();
  instance.use(initReactI18next).init({
    resources,
    lng: language ? normalizeLanguage(language) : readSavedLanguage(storage),
    fallbackLng: "en",
    supportedLngs: [...supportedLanguages],
    nonExplicitSupportedLngs: true,
    load: "languageOnly",
    defaultNS: "translation",
    ns: ["translation", "dashboard", "landing", "auth"],
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
  const catalog = translationResources[locale].translation;
  const fallback = translationResources.en.translation;
  const catalogValue = catalog[key as keyof typeof en];
  return catalogValue ?? fallback[key as keyof typeof en] ?? key;
}
