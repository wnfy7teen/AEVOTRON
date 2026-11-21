// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { getAppThemePreference, setAppTheme } from "../src/lib/ThemeSwitcher.jsx";

describe("workspace theme", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.colorScheme = "";
    document.body.innerHTML = '<div class="apple-app" id="workspace-one"></div><div class="apple-app" id="workspace-two"></div>';
    vi.restoreAllMocks();
  });

  it("uses the System appearance configured by workspace defaults", () => {
    expect(getAppThemePreference()).toBe("system");
  });

  it("applies a selected theme to the document and every mounted workspace", () => {
    setAppTheme("dark");

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(document.querySelector("#workspace-one").dataset.theme).toBe("dark");
    expect(document.querySelector("#workspace-two").dataset.theme).toBe("dark");
  });

  it("persists the preference and restores it after a simulated reload", () => {
    setAppTheme("dark");

    expect(window.localStorage.getItem("aevotron-theme")).toBe("dark");
    expect(JSON.parse(window.localStorage.getItem("aevotron-workspace-settings")).theme).toBe("dark");

    document.documentElement.removeAttribute("data-theme");
    document.querySelectorAll(".apple-app").forEach((element) => element.removeAttribute("data-theme"));

    const restoredPreference = getAppThemePreference();
    expect(restoredPreference).toBe("dark");
    setAppTheme(restoredPreference);

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect([...document.querySelectorAll(".apple-app")].every((element) => element.dataset.theme === "dark")).toBe(true);
  });

  it("stores System as the preference while resolving the operating-system color scheme", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });

    setAppTheme("system");

    expect(getAppThemePreference()).toBe("system");
    expect(window.localStorage.getItem("aevotron-theme")).toBe("system");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("falls back to System when the saved preference is invalid", () => {
    window.localStorage.setItem("aevotron-theme", "sepia");
    window.localStorage.setItem("aevotron-workspace-settings", JSON.stringify({ theme: "invalid" }));

    expect(getAppThemePreference()).toBe("system");
  });

  it("provides dark-theme overrides for workspace surfaces, typography, controls and navigation", async () => {
    const css = await readFile("src/apple-style.css", "utf8");
    const requiredDarkRules = [
      /\.apple-app\[data-theme="dark"\] \.mh-shell/,
      /\.apple-app\[data-theme="dark"\] \.mh-stat/,
      /\.apple-app\[data-theme="dark"\] \.mh-panel/,
      /\.apple-app\[data-theme="dark"\] \.mh-page-heading h1/,
      /\.apple-app\[data-theme="dark"\] \.mh-nav-item/,
      /\.apple-app\[data-theme="dark"\] \.mh-button-quiet/,
      /\.apple-app\[data-theme="dark"\] \.mh-field/,
      /\.apple-app\[data-theme="dark"\] \.mh-search/,
      /\.apple-app\[data-theme="dark"\] \.mh-icon-button/,
      /html\[data-theme="dark"\] \.av-theme-trigger/,
      /html\[data-theme="dark"\] \.av-language-menu/,
    ];

    for (const rule of requiredDarkRules) expect(css).toMatch(rule);
  });
});
