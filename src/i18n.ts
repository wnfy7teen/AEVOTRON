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

type MetadataState = { source: string; translated: string };
const metadataState = new WeakMap<Element, MetadataState>();

function translateMetadataElement(element: Element, attribute: "content" | null, language: SupportedLanguage) {
  const current = attribute ? element.getAttribute(attribute) ?? "" : element.textContent ?? "";
  let state = metadataState.get(element);
  if (!state || current !== state.translated) state = { source: current, translated: current };
  const translated = i18n.t(state.source, { lng: language, defaultValue: state.source });
  if (attribute) {
    if (current !== translated) element.setAttribute(attribute, translated);
  } else if (current !== translated) {
    element.textContent = translated;
  }
  state.translated = translated;
  metadataState.set(element, state);
}

function syncDocumentMetadata() {
  if (typeof document === "undefined") return;
  const language = normalizeLanguage(i18n.resolvedLanguage || i18n.language);
  document.documentElement.lang = language === "zh" ? "zh-CN" : language;
  const title = document.querySelector("head title");
  if (title) translateMetadataElement(title, null, language);
  document.querySelectorAll('meta[name="description"]').forEach((meta) => {
    translateMetadataElement(meta, "content", language);
  });
}

if (typeof document !== "undefined") {
  syncDocumentMetadata();
  i18n.on("languageChanged", syncDocumentMetadata);
  const metadataObserver = new MutationObserver(syncDocumentMetadata);
  metadataObserver.observe(document.head, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["content"],
  });
}

export default i18n;
