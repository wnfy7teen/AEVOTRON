import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { I18nextProvider, useTranslation } from "react-i18next";
import { changeAppLanguage, createAppI18n, getRouteNamespace, LANGUAGE_STORAGE_KEY, loadLocaleResources } from "@/i18n";

function LanguageProbe() {
  const { t } = useTranslation();
  return (
    <section>
      <output data-testid="translated">{t("Welcome back")}</output>
    </section>
  );
}

function DashboardProbe() {
  const { t } = useTranslation(["dashboard", "translation"]);
  return <output data-testid="dashboard-translation">{t("model.description.default")}</output>;
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

  it("loads the selected locale bundles before rerendering translated React content", async () => {
    const instance = createAppI18n(localStorage);
    await act(async () => {
      root.render(<I18nextProvider i18n={instance}><LanguageProbe /></I18nextProvider>);
    });

    expect(container.querySelector('[data-testid="translated"]').textContent).toBe("Welcome back");
    await act(async () => changeAppLanguage(instance, "ru"));
    expect(container.querySelector('[data-testid="translated"]').textContent).toBe("С возвращением");

    await act(async () => changeAppLanguage(instance, "zh"));
    expect(container.querySelector('[data-testid="translated"]').textContent).toBe("欢迎回来");
  });

  it("preloads only the active route namespace when switching languages", async () => {
    const instance = createAppI18n({ language: "en", storage: null });
    const resources = await loadLocaleResources("en", ["dashboard"]);
    instance.addResourceBundle("en", "dashboard", resources.dashboard, true, true);
    await act(async () => {
      root.render(<I18nextProvider i18n={instance}><DashboardProbe /></I18nextProvider>);
    });

    expect(container.querySelector('[data-testid="dashboard-translation"]').textContent)
      .toBe("A text AI model for conversations, generation, and content analysis.");
    await act(async () => changeAppLanguage(instance, "zh"));
    expect(container.querySelector('[data-testid="dashboard-translation"]').textContent)
      .toBe("用于对话、内容生成和分析的文本 AI 模型。");
    expect(instance.hasResourceBundle("zh", "landing")).toBe(false);
    expect(instance.hasResourceBundle("zh", "auth")).toBe(false);
  });

  it("persists the selected locale and restores it for a fresh page instance", async () => {
    const firstPage = createAppI18n(localStorage);
    await changeAppLanguage(firstPage, "ru");
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

  it("isolates locale state and loaded namespace bundles between independent SSR request instances", async () => {
    const [enResources, ruResources, zhResources] = await Promise.all([
      loadLocaleResources("en"),
      loadLocaleResources("ru"),
      loadLocaleResources("zh"),
    ]);
    const englishRequest = createAppI18n({ language: "en", storage: null, resources: { en: enResources } });
    const russianRequest = createAppI18n({ language: "ru", storage: null, resources: { ru: ruResources } });
    const chineseRequest = createAppI18n({ language: "zh", storage: null, resources: { zh: zhResources } });

    expect(englishRequest.t("Welcome back")).toBe("Welcome back");
    expect(russianRequest.t("Welcome back")).toBe("С возвращением");
    expect(chineseRequest.t("Welcome back")).toBe("欢迎回来");

    await changeAppLanguage(russianRequest, "zh");
    expect(englishRequest.language).toBe("en");
    expect(chineseRequest.language).toBe("zh");
  });

  it("loads non-core namespaces only when requested and keeps their translations available", async () => {
    const instance = createAppI18n({ language: "ru", storage: null });
    expect(instance.hasResourceBundle("ru", "dashboard")).toBe(false);
    const resources = await loadLocaleResources("ru", ["dashboard"]);
    expect(Object.keys(resources)).toEqual(["dashboard"]);
    instance.addResourceBundle("ru", "dashboard", resources.dashboard, true, true);
    expect(instance.hasResourceBundle("ru", "dashboard")).toBe(true);
    expect(instance.hasResourceBundle("ru", "landing")).toBe(false);
    expect(instance.getFixedT("ru", "dashboard")("model.description.default")).toContain("Текстовая AI-модель");
  });

  it("loads only the namespace required by the requested route during SSR", () => {
    expect(getRouteNamespace("/")).toBe("landing");
    expect(getRouteNamespace("/login")).toBe("auth");
    expect(getRouteNamespace("/forgot-password")).toBe("auth");
    expect(getRouteNamespace("/dashboard")).toBe("dashboard");
    expect(getRouteNamespace("/workspace")).toBe("dashboard");
    expect(getRouteNamespace("/workspace-preview")).toBe("dashboard");
    expect(getRouteNamespace("/unknown")).toBeUndefined();
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
