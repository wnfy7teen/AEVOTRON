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

  it("defaults to the light theme", () => {
    expect(getAppThemePreference()).toBe("light");
  });

  it("applies a selected theme to the document and every mounted workspace", () => {
    setAppTheme("gray");

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(document.querySelector("#workspace-one").dataset.theme).toBe("dark");
    expect(document.querySelector("#workspace-two").dataset.theme).toBe("dark");
  });

  it("persists the preference and restores it after a simulated reload", () => {
    setAppTheme("gray");

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

  it("normalizes legacy dark and unsupported system preferences to the two supported themes", () => {
    setAppTheme("dark");
    expect(getAppThemePreference()).toBe("dark");
    expect(window.localStorage.getItem("aevotron-theme")).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");

    setAppTheme("system");
    expect(getAppThemePreference()).toBe("light");
    expect(window.localStorage.getItem("aevotron-theme")).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  it("migrates legacy and unsupported stored preferences to one of the two themes", () => {
    window.localStorage.setItem("aevotron-theme", "dark");
    expect(getAppThemePreference()).toBe("dark");
    expect(window.localStorage.getItem("aevotron-theme")).toBe("dark");
    window.localStorage.setItem("aevotron-theme", "system");
    expect(getAppThemePreference()).toBe("light");
    expect(window.localStorage.getItem("aevotron-theme")).toBe("light");
  });

  it("falls back to Light when the saved preference is invalid", () => {
    window.localStorage.setItem("aevotron-theme", "sepia");
    window.localStorage.setItem("aevotron-workspace-settings", JSON.stringify({ theme: "invalid" }));

    expect(getAppThemePreference()).toBe("light");
  });

  it("keeps every CSS color literal inside the centralized palette token block", async () => {
    const css = await readFile("src/apple-style.css", "utf8");
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    expect(css).not.toMatch(/#000000|#000\b/i);
    const paletteNames = [...css.matchAll(/^\s*(--palette-[\w-]+):/gm)].map((match) => match[1]);
    expect(new Set(paletteNames).size).toBe(paletteNames.length);
  });

  it("styles the model trust notice with readable light and gray variants", async () => {
    const css = await readFile("src/apple-style.css", "utf8");

    expect(css).toMatch(/\.apple-app \.mh-detail-info\s*\{[^}]*display:\s*flex/s);
    expect(css).toMatch(/\.apple-app \.mh-detail-info-icon\s*\{[^}]*flex:\s*0 0 32px/s);
    expect(css).toMatch(/\.apple-app\[data-theme="dark"\] \.mh-detail-info\s*\{[^}]*color:\s*var\(--palette-hex-c3def7\)/s);
    expect(css).toMatch(/\.apple-app\[data-theme="dark"\] \.mh-detail-info-icon\s*\{[^}]*color:\s*var\(--palette-hex-a9d7ff\)/s);
  });

  it("provides dark-theme overrides for workspace surfaces, typography, controls and navigation", async () => {
    const css = await readFile("src/apple-style.css", "utf8");
    const requiredGrayRules = [
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

    for (const rule of requiredGrayRules) expect(css).toMatch(rule);
  });
});
