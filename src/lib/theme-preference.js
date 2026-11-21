const THEME_STORAGE_KEY = "aevotron-theme";
const DEFAULT_THEME = "gray";

export function readThemePreference(storage) {
  try {
    const target = storage ?? (typeof window !== "undefined" ? window.localStorage : null);
    return target?.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function writeThemePreference(theme, storage) {
  if (theme !== "dark" && theme !== "gray") return;
  try {
    const target = storage ?? (typeof window !== "undefined" ? window.localStorage : null);
    target?.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Theme switching must continue to work when browser storage is blocked.
  }
}
