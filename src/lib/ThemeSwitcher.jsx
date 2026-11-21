import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export function ThemeSwitcher() {
  const { t } = useLanguage();
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    try { return window.localStorage.getItem("aevotron-theme") === "dark" ? "dark" : "light"; }
    catch { return "light"; }
  });
  useEffect(() => {
    document.querySelectorAll(".apple-app").forEach((element) => { element.dataset.theme = theme; });
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try { window.localStorage.setItem("aevotron-theme", theme); } catch { /* session-only */ }
  }, [theme]);
  const dark = theme === "dark";
  const label = dark ? t("Switch to light theme") : t("Switch to dark theme");
  return <button type="button" className="av-theme-trigger"
    onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}
    aria-label={label}
    title={label} aria-pressed={dark}>
    {dark ? <Sun size={18}/> : <Moon size={18}/>}
    <span>{label}</span>
  </button>;
}
