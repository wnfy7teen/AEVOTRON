import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useTranslation } from "react-i18next";
import i18n, { resources } from "../src/i18n";
import { LanguageProvider, LanguageSwitcher } from "../src/lib/i18n";

function TranslationProbe() {
  const { t } = useTranslation();
  return <output aria-label="translated-value">{t("Overview")}</output>;
}

describe("application i18n", () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage("en");
  });

  afterEach(() => {
    cleanup();
  });

  it("rerenders mounted React components immediately after changing language", async () => {
    render(
      <LanguageProvider>
        <TranslationProbe />
        <LanguageSwitcher />
      </LanguageProvider>,
    );

    expect(screen.getByLabelText("translated-value").textContent).toBe("Overview");
    fireEvent.click(screen.getByRole("button", { name: "Language" }));
    fireEvent.click(screen.getByRole("option", { name: /Русский/ }));

    await waitFor(() => {
      expect(screen.getByLabelText("translated-value").textContent).toBe("Обзор");
    });
    expect(i18n.language).toBe("ru");
  });

  it("persists the selected language in localStorage", async () => {
    await i18n.changeLanguage("zh");
    expect(localStorage.getItem("aevotron-language")).toBe("zh");
  });

  it("provides identical translation key sets for all supported locales", () => {
    const expected = Object.keys(resources.en.translation).sort();
    expect(Object.keys(resources.ru.translation).sort()).toEqual(expected);
    expect(Object.keys(resources.zh.translation).sort()).toEqual(expected);
  });
});
