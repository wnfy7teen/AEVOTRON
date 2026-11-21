import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeSwitcher() {
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
  return <button type="button" className="av-theme-trigger"
    onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}
    aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
    title={dark ? "Светлая тема" : "Тёмная тема"} aria-pressed={dark}>
    {dark ? <Sun size={18}/> : <Moon size={18}/>}
    <span>{dark ? "Светлая тема" : "Тёмная тема"}</span>
  </button>;
}
