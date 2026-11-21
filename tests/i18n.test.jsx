import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

describe("application i18n", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => cleanup());

  it("rerenders translated React content immediately when the language changes", async () => {
    const instance = createAppI18n(localStorage);
    render(<I18nextProvider i18n={instance}><LanguageProbe /></I18nextProvider>);

    expect(screen.getByTestId("translated").textContent).toBe("Welcome back");
    fireEvent.click(screen.getByRole("button", { name: "Switch to Russian" }));
    await waitFor(() => expect(screen.getByTestId("translated").textContent).toBe("С возвращением"));

    fireEvent.click(screen.getByRole("button", { name: "Switch to Chinese" }));
    await waitFor(() => expect(screen.getByTestId("translated").textContent).toBe("欢迎回来"));
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
