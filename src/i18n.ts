import { createInstance, type i18n as I18nInstance, type Resource } from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ru from "./locales/ru.json";
import zh from "./locales/zh.json";

export const LANGUAGE_STORAGE_KEY = "aevotron-language";
export const LANGUAGE_COOKIE_KEY = "aevotron-language";
export const supportedLanguages = ["en", "ru", "zh"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];
export type LocaleNamespace = "dashboard" | "landing" | "auth";

export function getRouteNamespace(pathname: string): LocaleNamespace | undefined {
  const path = pathname.replace(/\\/+$/, "") || "/";
  if (path === "/") return "landing";
  if (/^\\/(?:login|register|forgot-password|reset-password|mfa|verify-email)(?:\\/|$)/.test(path)) return "auth";
  if (/^\\/(?:dashboard|workspace|workspace-preview)(?:\\/|$)/.test(path)) return "dashboard";
  return undefined;
}
export type LocaleNamespaces = Record<LocaleNamespace, Record<string, string>>;

const translationResources = {
  en: { translation: en },
  ru: { translation: ru },
  zh: { translation: zh },
};

type NamespaceLoader = () => Promise<Record<string, string>>;
const namespaceLoaders: Record<SupportedLanguage, Record<LocaleNamespace, NamespaceLoader>> = {
  en: {
    dashboard: async () => (await import("./locales/dashboard/en.json")).default,
    landing: async () => (await import("./locales/landing/en.json")).default,
    auth: async () => (await import("./locales/auth/en.json")).default,
  },
  ru: {
    dashboard: async () => (await import("./locales/dashboard/ru.json")).default,
    landing: async () => (await import("./locales/landing/ru.json")).default,
    auth: async () => (await import("./locales/auth/ru.json")).default,
  },
  zh: {
    dashboard: async () => (await import("./locales/dashboard/zh.json")).default,
    landing: async () => (await import("./locales/landing/zh.json")).default,
    auth: async () => (await import("./locales/auth/zh.json")).default,
  },
};

const namespacePromises = new Map<string, Promise<Record<string, string>>>();

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

async function loadNamespace(language: string, namespace: LocaleNamespace) {
  const locale = normalizeLanguage(language);
  const cacheKey = `${locale}:${namespace}`;
  const cached = namespacePromises.get(cacheKey);
  if (cached) return cached;

  const pending = namespaceLoaders[locale][namespace]().catch((error) => {
    namespacePromises.delete(cacheKey);
    throw error;
  });
  namespacePromises.set(cacheKey, pending);
  return pending;
}

export async function loadLocaleResources(
  language: string,
  namespaces: readonly LocaleNamespace[] = ["dashboard", "landing", "auth"],
): Promise<Partial<LocaleNamespaces>> {
  const entries = await Promise.all(namespaces.map(async (namespace) => [
    namespace,
    await loadNamespace(language, namespace),
  ] as const));
  return Object.fromEntries(entries) as Partial<LocaleNamespaces>;
}

const localeBackend = {
  type: "backend" as const,
  init() {},
  read(language: string, namespace: string, callback: (error: Error | null, data?: Record<string, string> | false) => void) {
    const locale = normalizeLanguage(language);
    if (namespace === "translation") {
      callback(null, translationResources[locale].translation);
      return;
    }
    if (namespace !== "dashboard" && namespace !== "landing" && namespace !== "auth") {
      callback(new Error(`Unsupported i18n namespace: ${namespace}`), false);
      return;
    }
    void loadNamespace(locale, namespace).then(
      (resources) => callback(null, resources),
      (error: unknown) => callback(error instanceof Error ? error : new Error(String(error)), false),
    );
  },
};

export async function changeAppLanguage(instance: I18nInstance, language: string): Promise<void> {
  await instance.changeLanguage(normalizeLanguage(language));
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
  instance.use(localeBackend).use(initReactI18next).init({
    resources,
    lng: language ? normalizeLanguage(language) : readSavedLanguage(storage),
    fallbackLng: "en",
    supportedLngs: [...supportedLanguages],
    nonExplicitSupportedLngs: true,
    load: "languageOnly",
    defaultNS: "translation",
    ns: ["translation"],
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
