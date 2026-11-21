import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Moon, Sun } from "lucide-react";

const THEME_STORAGE_KEY = "aevotron-theme";
const THEME_CHANGE_EVENT = "aevotron:theme-change";
const VALID_THEMES = new Set(["light", "dark", "system"]);

function readThemePreference() {
  if (typeof window === "undefined") return "light";
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (VALID_THEMES.has(stored)) return stored;
    const settings = JSON.parse(window.localStorage.getItem("aevotron-workspace-settings") || "{}");
    return VALID_THEMES.has(settings.theme) ? settings.theme : "system";
  } catch {
    return "system";
  }
}

export function getAppThemePreference() {
  return readThemePreference();
}

function resolveTheme(theme) {
  if (theme !== "system" || typeof window === "undefined" || !window.matchMedia) return theme === "dark" ? "dark" : "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyResolvedTheme(preference) {
  const theme = resolveTheme(preference);
  if (typeof document === "undefined") return;
  document.querySelectorAll(".apple-app").forEach((element) => { element.dataset.theme = theme; });
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function setAppTheme(theme) {
  const preference = VALID_THEMES.has(theme) ? theme : "light";
  applyResolvedTheme(preference);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    const settings = JSON.parse(window.localStorage.getItem("aevotron-workspace-settings") || "{}");
    window.localStorage.setItem("aevotron-workspace-settings", JSON.stringify({ ...settings, theme: preference }));
  } catch {
    // Keep the current theme for this session if browser storage is unavailable.
  }
  window.dispatchEvent(new window.CustomEvent(THEME_CHANGE_EVENT, { detail: preference }));
}

export function ThemeSwitcher() {
  const { t } = useTranslation();
  const [theme, setTheme] = useState(readThemePreference);
  useEffect(() => {
    const syncTheme = (event) => {
      const nextTheme = VALID_THEMES.has(event.detail) ? event.detail : readThemePreference();
      setTheme(nextTheme);
      applyResolvedTheme(nextTheme);
    };
    window.addEventListener(THEME_CHANGE_EVENT, syncTheme);
    applyResolvedTheme(theme);

    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const handleSystemChange = () => {
      if (theme === "system") applyResolvedTheme("system");
    };
    media?.addEventListener?.("change", handleSystemChange);

    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, syncTheme);
      media?.removeEventListener?.("change", handleSystemChange);
    };
  }, [theme]);

  const dark = resolveTheme(theme) === "dark";
  return <button type="button" className="av-theme-trigger"
    onClick={() => setAppTheme(dark ? "light" : "dark")}
    aria-label={dark ? t("Switch to light theme") : t("Switch to dark theme")}
    title={dark ? t("Light theme") : t("Dark theme")} aria-pressed={dark}>
    {dark ? <Sun size={18}/> : <Moon size={18}/>}
    <span>{dark ? t("Light theme") : t("Dark theme")}</span>
  </button>;
}
