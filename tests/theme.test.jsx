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

    expect(document.documentElement.dataset.theme).toBe("gray");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(document.querySelector("#workspace-one").dataset.theme).toBe("gray");
    expect(document.querySelector("#workspace-two").dataset.theme).toBe("gray");
  });

  it("persists the preference and restores it after a simulated reload", () => {
    setAppTheme("gray");

    expect(window.localStorage.getItem("aevotron-theme")).toBe("gray");
    expect(JSON.parse(window.localStorage.getItem("aevotron-workspace-settings")).theme).toBe("gray");

    document.documentElement.removeAttribute("data-theme");
    document.querySelectorAll(".apple-app").forEach((element) => element.removeAttribute("data-theme"));

    const restoredPreference = getAppThemePreference();
    expect(restoredPreference).toBe("gray");
    setAppTheme(restoredPreference);

    expect(document.documentElement.dataset.theme).toBe("gray");
    expect([...document.querySelectorAll(".apple-app")].every((element) => element.dataset.theme === "gray")).toBe(true);
  });

  it("normalizes legacy dark and unsupported system preferences to the two supported themes", () => {
    setAppTheme("dark");
    expect(getAppThemePreference()).toBe("gray");
    expect(window.localStorage.getItem("aevotron-theme")).toBe("gray");
    expect(document.documentElement.dataset.theme).toBe("gray");
    expect(document.documentElement.style.colorScheme).toBe("dark");

    setAppTheme("system");
    expect(getAppThemePreference()).toBe("light");
    expect(window.localStorage.getItem("aevotron-theme")).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  it("falls back to Light when the saved preference is invalid", () => {
    window.localStorage.setItem("aevotron-theme", "sepia");
    window.localStorage.setItem("aevotron-workspace-settings", JSON.stringify({ theme: "invalid" }));

    expect(getAppThemePreference()).toBe("light");
  });

  it("styles the model trust notice with readable light and gray variants", async () => {
    const css = await readFile("src/apple-style.css", "utf8");

    expect(css).toMatch(/\.apple-app \.mh-detail-info\s*\{[^}]*display:\s*flex/s);
    expect(css).toMatch(/\.apple-app \.mh-detail-info-icon\s*\{[^}]*flex:\s*0 0 32px/s);
    expect(css).toMatch(/\.apple-app\[data-theme="gray"\] \.mh-detail-info\s*\{[^}]*color:\s*#c3def7/s);
    expect(css).toMatch(/\.apple-app\[data-theme="gray"\] \.mh-detail-info-icon\s*\{[^}]*color:\s*#a9d7ff/s);
  });

  it("provides gray-theme overrides for workspace surfaces, typography, controls and navigation", async () => {
    const css = await readFile("src/apple-style.css", "utf8");
    const requiredGrayRules = [
      /\.apple-app\[data-theme="gray"\] \.mh-shell/,
      /\.apple-app\[data-theme="gray"\] \.mh-stat/,
      /\.apple-app\[data-theme="gray"\] \.mh-panel/,
      /\.apple-app\[data-theme="gray"\] \.mh-page-heading h1/,
      /\.apple-app\[data-theme="gray"\] \.mh-nav-item/,
      /\.apple-app\[data-theme="gray"\] \.mh-button-quiet/,
      /\.apple-app\[data-theme="gray"\] \.mh-field/,
      /\.apple-app\[data-theme="gray"\] \.mh-search/,
      /\.apple-app\[data-theme="gray"\] \.mh-icon-button/,
      /html\[data-theme="gray"\] \.av-theme-trigger/,
      /html\[data-theme="gray"\] \.av-language-menu/,
    ];

    for (const rule of requiredGrayRules) expect(css).toMatch(rule);
  });
});
