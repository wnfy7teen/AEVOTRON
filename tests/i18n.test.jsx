import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { I18nextProvider, useTranslation } from "react-i18next";
import { createAppI18n, LANGUAGE_STORAGE_KEY } from "@/i18n";

function LanguageProbe() {
  const { t, i18n } = useTranslation();
  return (
    <section>
      <output data-testid="translated">{t("Welcome back")}</output>
      <button type="button" onClick={() => i18n.changeLanguage("ru")}>Switch to Russian</button>
      <button type="button" onClick={() => i18n.changeLanguage("zh")}>Switch to Chinese</button>
    </section>
  );
}

let container;
let root;

describe("application i18n", () => {
  beforeEach(() => {
    localStorage.clear();
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    if (root) await act(async () => root.unmount());
    container?.remove();
    root = null;
  });

  it("rerenders translated React content immediately when the language changes", async () => {
    const instance = createAppI18n(localStorage);
    await act(async () => {
      root.render(<I18nextProvider i18n={instance}><LanguageProbe /></I18nextProvider>);
    });

    expect(container.querySelector('[data-testid="translated"]').textContent).toBe("Welcome back");
    await act(async () => instance.changeLanguage("ru"));
    expect(container.querySelector('[data-testid="translated"]').textContent).toBe("С возвращением");

    await act(async () => instance.changeLanguage("zh"));
    expect(container.querySelector('[data-testid="translated"]').textContent).toBe("欢迎回来");
  });

  it("persists the selected locale and restores it for a fresh page instance", async () => {
    const firstPage = createAppI18n(localStorage);
    await firstPage.changeLanguage("ru");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("ru");

    const reloadedPage = createAppI18n(localStorage);
    expect(reloadedPage.resolvedLanguage).toBe("ru");
    expect(reloadedPage.t("Welcome back")).toBe("С возвращением");
  });

  it("falls back to English for unsupported or missing locale values", () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "fr-FR");
    const freshPage = createAppI18n(localStorage);
    expect(freshPage.resolvedLanguage).toBe("en");
    expect(freshPage.t("Welcome back")).toBe("Welcome back");
  });
  it("isolates locale state between independent SSR request instances", () => {
    const englishRequest = createAppI18n({ language: "en", storage: null });
    const russianRequest = createAppI18n({ language: "ru", storage: null });
    const chineseRequest = createAppI18n({ language: "zh", storage: null });

    expect(englishRequest.t("Welcome back")).toBe("Welcome back");
    expect(russianRequest.t("Welcome back")).toBe("С возвращением");
    expect(chineseRequest.t("Welcome back")).toBe("欢迎回来");

    russianRequest.changeLanguage("zh");
    expect(englishRequest.language).toBe("en");
    expect(chineseRequest.language).toBe("zh");
  });

  it("supports locale-aware plural forms and interpolation", () => {
    const english = createAppI18n({ language: "en", storage: null });
    const russian = createAppI18n({ language: "ru", storage: null });
    const chinese = createAppI18n({ language: "zh", storage: null });

    expect(english.t("i18n.test.item", { count: 1 })).toBe("1 item");
    expect(english.t("i18n.test.item", { count: 3 })).toBe("3 items");
    expect(russian.t("i18n.test.item", { count: 2 })).toBe("2 элемента");
    expect(russian.t("i18n.test.item", { count: 5 })).toBe("5 элементов");
    expect(chinese.t("i18n.test.item", { count: 2 })).toBe("2 个项目");
  });

  it("normalizes regional language tags and uses the supported fallback", async () => {
    const { normalizeLanguage } = await import("@/i18n");
    expect(normalizeLanguage("ru-RU")).toBe("ru");
    expect(normalizeLanguage("zh-CN")).toBe("zh");
    expect(normalizeLanguage("fr-FR")).toBe("en");
    expect(normalizeLanguage(null)).toBe("en");
  });

});
