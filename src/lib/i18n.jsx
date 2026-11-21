import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n, { supportedLanguages } from "@/i18n";

export function LanguageProvider({ children }) {
  return children;
}

export function useLanguage() {
  const { t, i18n: instance } = useTranslation();
  const language = (instance.resolvedLanguage || instance.language || "en").split("-")[0];
  return {
    language,
    t,
    setLanguage: (next) => {
      if (supportedLanguages.includes(next)) void instance.changeLanguage(next);
    },
  };
}

export function LanguageSwitcher() {
  const { t, i18n: instance } = useTranslation();
  const language = (instance.resolvedLanguage || instance.language || "en").split("-")[0];
  const [open, setOpen] = useState(false);
  const switcherRef = useRef(null);
  const triggerRef = useRef(null);
  const options = [
    { code: "en", label: "English", native: "EN" },
    { code: "ru", label: "Русский", native: "RU" },
    { code: "zh", label: "简体中文", native: "中文" },
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

  const selectLanguage = (next) => {
    void instance.changeLanguage(next);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div ref={switcherRef} className="av-language-switcher" data-open={open}>
      {open && (
        <div id="av-language-menu" className="av-language-menu" role="listbox" aria-label={t("Language")}>
          <span className="av-language-menu-title">{t("Interface language")}</span>
          {options.map((option) => (
            <button
              key={option.code}
              type="button"
              role="option"
              aria-selected={language === option.code}
              className={language === option.code ? "active" : ""}
              onClick={() => selectLanguage(option.code)}
            >
              <span className="av-language-native">{option.native}</span>
              <span>{option.label}</span>
              {language === option.code && <Check size={15} />}
            </button>
          ))}
        </div>
      )}
      <button
        ref={triggerRef}
        type="button"
        className="av-language-trigger"
        aria-label={t("Language")}
        aria-haspopup="listbox"
        aria-controls="av-language-menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="av-language-globe" aria-hidden="true">文</span>
        <span className="av-language-current" data-language={current.code} data-no-translate>
          {current.code.toUpperCase()}
        </span>
        <ChevronDown size={14} className={open ? "is-open" : ""} aria-hidden="true" />
      </button>
    </div>
  );
}
