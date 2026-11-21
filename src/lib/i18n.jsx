import { useEffect, useMemo, useRef, useState } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import { Check, ChevronDown } from "lucide-react";
import i18n, { normalizeLanguage, supportedLanguages } from "@/i18n";

const sourceText = new WeakMap();
const sourceAttributes = new WeakMap();
let sourceTitle = null;

function translateLegacy(value, language) {
  if (!value) return value;
  const trimmed = value.replace(/\u00a0/g, " ").trim();
  if (!trimmed) return value;
  const exact = i18n.t(trimmed, { lng: language, defaultValue: trimmed });
  if (exact !== trimmed) return value.replace(value.trim(), exact);

  let result = value;
  const catalog = i18n.getResourceBundle(language, "translation") || {};
  const entries = Object.entries(catalog).sort((a, b) => b[0].length - a[0].length);
  for (const [key, translation] of entries) {
    if (!key || typeof translation !== "string" || key === translation) continue;
    if (key.includes(" ") || /[\u4e00-\u9fff\u0400-\u04ff]/u.test(key)) {
      if (result.includes(key)) result = result.split(key).join(translation);
    } else if (result === key) {
      result = translation;
    }
  }
  return result;
}

function applyLegacyTranslations(language) {
  if (typeof document === "undefined" || !document.body) return;
  document.documentElement.lang = language === "zh" ? "zh-CN" : language;
  if (sourceTitle === null || document.title !== sourceTitle.translated) {
    sourceTitle = { source: document.title, translated: document.title };
  }
  const nextTitle = translateLegacy(sourceTitle.source, language);
  if (document.title !== nextTitle) document.title = nextTitle;
  sourceTitle.translated = nextTitle;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const current = node.nodeValue ?? "";
    let state = sourceText.get(node);
    if (!state || current !== state.translated) state = { source: current, translated: current };
    if (node.parentElement?.closest("[data-no-translate], pre, code, script, style")) {
      sourceText.set(node, { source: current, translated: current });
      continue;
    }
    const next = translateLegacy(state.source, language);
    if (next !== current) node.nodeValue = next;
    state.translated = next;
    sourceText.set(node, state);
  }

  document.querySelectorAll("input[placeholder], textarea[placeholder], [aria-label], [title], [alt], meta[name=description]").forEach((element) => {
    for (const attribute of ["placeholder", "aria-label", "title", "alt", "content"]) {
      const current = element.getAttribute(attribute);
      if (current === null) continue;
      let originals = sourceAttributes.get(element);
      if (!originals) {
        originals = {};
        sourceAttributes.set(element, originals);
      }
      let state = originals[attribute];
      if (!state || current !== state.translated) state = { source: current, translated: current };
      if (element.closest("[data-no-translate]")) {
        originals[attribute] = { source: current, translated: current };
        continue;
      }
      const next = translateLegacy(state.source, language);
      if (next !== current) element.setAttribute(attribute, next);
      state.translated = next;
      originals[attribute] = state;
    }
  });
}

export function LanguageProvider({ children }) {
  useEffect(() => {
    const apply = () => applyLegacyTranslations(normalizeLanguage(i18n.resolvedLanguage || i18n.language));
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, {
      childList: true, subtree: true, characterData: true, attributes: true,
      attributeFilter: ["aria-label", "title", "placeholder", "alt", "content"],
    });
    i18n.on("languageChanged", apply);
    return () => {
      observer.disconnect();
      i18n.off("languageChanged", apply);
    };
  }, []);
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

export function useLanguage() {
  const { t, i18n: activeI18n } = useTranslation();
  const language = normalizeLanguage(activeI18n.resolvedLanguage || activeI18n.language);
  const setLanguage = useMemo(() => (next) => {
    if (supportedLanguages.includes(next)) return activeI18n.changeLanguage(next);
    return Promise.resolve();
  }, [activeI18n]);
  return { language, setLanguage, t };
}

export function LanguageSwitcher() {
  const { t, i18n: activeI18n } = useTranslation();
  const language = normalizeLanguage(activeI18n.resolvedLanguage || activeI18n.language);
  const [open, setOpen] = useState(false);
  const switcherRef = useRef(null);
  const triggerRef = useRef(null);
  const options = [
    { code: "en", label: t("English"), native: "EN" },
    { code: "ru", label: t("Russian"), native: "RU" },
    { code: "zh", label: t("Chinese (Simplified)"), native: "中文" },
  ];
  const current = options.find((option) => option.code === language) ?? options[0];

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (!switcherRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const selectLanguage = async (next) => {
    await activeI18n.changeLanguage(next);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div ref={switcherRef} className="av-language-switcher" data-open={open}>
      {open && (
        <div id="av-language-menu" className="av-language-menu" role="listbox" aria-label={t("Language")}>
          <span className="av-language-menu-title">{t("Interface language")}</span>
          {options.map((option) => (
            <button key={option.code} type="button" role="option" aria-selected={language === option.code}
              className={language === option.code ? "active" : ""} onClick={() => selectLanguage(option.code)}>
              <span className="av-language-native">{option.native}</span>
              <span>{option.label}</span>
              {language === option.code && <Check size={15} />}
            </button>
          ))}
        </div>
      )}
      <button ref={triggerRef} type="button" className="av-language-trigger" aria-label={t("Language")}
        aria-haspopup="listbox" aria-controls="av-language-menu" aria-expanded={open}
        onClick={() => setOpen((value) => !value)}>
        <span className="av-language-globe" aria-hidden="true">文</span>
        <span className="av-language-current" data-language={current.code} data-no-translate>{current.code.toUpperCase()}</span>
        <ChevronDown size={14} className={open ? "is-open" : ""} aria-hidden="true" />
      </button>
    </div>
  );
}
