import React, { useMemo, useRef, useState } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import { Check, ChevronDown } from "lucide-react";
import { createAppI18n, normalizeLanguage, persistLanguageCookie, supportedLanguages } from "@/i18n";

function getBrowserStorage() {
  try { return typeof window !== "undefined" ? window.localStorage : null; } catch { return null; }
}

export function LanguageProvider({ children, initialLanguage = "en" }) {
  const [instance] = useState(() => createAppI18n({
    language: initialLanguage,
    storage: getBrowserStorage(),
  }));
  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}

export function useLanguage(namespaces) {
  const { t, i18n: activeI18n } = useTranslation(namespaces);
  const language = normalizeLanguage(activeI18n.resolvedLanguage || activeI18n.language);
  const setLanguage = useMemo(() => (next) => {
    if (!supportedLanguages.includes(next)) return Promise.resolve();
    persistLanguageCookie(next);
    return activeI18n.changeLanguage(next);
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

  React.useEffect(() => {
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
    persistLanguageCookie(next);
    await activeI18n.changeLanguage(next);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div ref={switcherRef} className="av-language-switcher" data-open={open}>
      {open && (
        <div id="av-language-menu" className="av-language-menu" role="group" aria-label={t("Language")}>
          <span className="av-language-menu-title">{t("Interface language")}</span>
          {options.map((option) => (
            <button key={option.code} type="button" aria-pressed={language === option.code}
              className={language === option.code ? "active" : ""} onClick={() => selectLanguage(option.code)}>
              <span className="av-language-native">{option.native}</span>
              <span>{option.label}</span>
              {language === option.code && <Check size={15} />}
            </button>
          ))}
        </div>
      )}
      <button ref={triggerRef} type="button" className="av-language-trigger" aria-label={t("Language")}
        aria-haspopup="true" aria-controls="av-language-menu" aria-expanded={open}
        onClick={() => setOpen((value) => !value)}>
        <span className="av-language-globe" aria-hidden="true">文</span>
        <span className="av-language-current" data-language={current.code} data-no-translate>{current.code.toUpperCase()}</span>
        <ChevronDown size={14} className={open ? "is-open" : ""} aria-hidden="true" />
      </button>
    </div>
  );
}
