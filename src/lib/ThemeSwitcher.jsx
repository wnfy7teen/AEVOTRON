import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Moon, Sun } from "lucide-react";

const THEME_STORAGE_KEY = "aevotron-theme";
const THEME_CHANGE_EVENT = "aevotron:theme-change";
const VALID_THEMES = new Set(["light", "dark"]);

function normalizeTheme(value) {
  if (value === "gray") return "dark";
  return VALID_THEMES.has(value) ? value : "light";
}

function readThemePreference() {
  if (typeof window === "undefined") return "light";
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    const settings = JSON.parse(window.localStorage.getItem("aevotron-workspace-settings") || "{}");
    const normalized = normalizeTheme(stored || settings.theme);
    if (stored !== normalized) window.localStorage.setItem(THEME_STORAGE_KEY, normalized);
    return normalized;
  } catch {
    return "light";
  }
}

export function getAppThemePreference() {
  return readThemePreference();
}

function applyResolvedTheme(theme) {
  if (typeof document === "undefined") return;
  document.querySelectorAll(".apple-app").forEach((element) => { element.dataset.theme = theme; });
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme === "dark" ? "dark" : "light";
}

export function setAppTheme(theme) {
  const preference = normalizeTheme(theme);
  applyResolvedTheme(preference);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    const settings = JSON.parse(window.localStorage.getItem("aevotron-workspace-settings") || "{}");
    window.localStorage.setItem("aevotron-workspace-settings", JSON.stringify({ ...settings, theme: preference }));
  } catch {
    // Keep the selected theme for this session if storage is unavailable.
  }
  window.dispatchEvent(new window.CustomEvent(THEME_CHANGE_EVENT, { detail: preference }));
}

export function ThemeSwitcher() {
  const { t } = useTranslation();
  const [theme, setTheme] = useState(readThemePreference);
  useEffect(() => {
    const syncTheme = (event) => {
      const nextTheme = normalizeTheme(event.detail || readThemePreference());
      setTheme(nextTheme);
      applyResolvedTheme(nextTheme);
    };
    window.addEventListener(THEME_CHANGE_EVENT, syncTheme);
    applyResolvedTheme(theme);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, syncTheme);
  }, [theme]);

  const gray = theme === "dark";
  return <button type="button" className="av-theme-trigger"
    onClick={() => setAppTheme(gray ? "light" : "dark")}
    aria-label={gray ? t("Switch to light theme") : t("Switch to gray theme")}
    title={gray ? t("Light theme") : t("Gray theme")} aria-pressed={gray}>
    {gray ? <Sun size={18}/> : <Moon size={18}/>}
    <span>{gray ? t("Light theme") : t("Gray theme")}</span>
  </button>;
}
