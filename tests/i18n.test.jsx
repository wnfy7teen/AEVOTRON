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
});
