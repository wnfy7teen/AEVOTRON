import React, { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LanguageProvider, useLanguage } from "@/lib/i18n";

function HydrationProbe() {
  const { language, t } = useLanguage();
  return <p data-testid="locale">{language}:{t("Welcome back")}</p>;
}

describe("i18n SSR hydration", () => {
  let container;
  let root;

  beforeEach(() => {
    localStorage.clear();
    document.cookie = "aevotron-language=; Path=/; Max-Age=0";
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => root.unmount());
    }
    container?.remove();
    root = null;
  });

  it.each([
    ["en", "Welcome back"],
    ["ru", "С возвращением"],
    ["zh", "欢迎回来"],
  ])("hydrates the %s server locale without replacing translated markup", async (locale, expectedText) => {
    const app = (
      <LanguageProvider initialLanguage={locale}>
        <HydrationProbe />
      </LanguageProvider>
    );
    const serverMarkup = renderToString(app);
    container.innerHTML = serverMarkup;
    const recoverableErrors = [];

    await act(async () => {
      root = hydrateRoot(container, app, {
        onRecoverableError: (error) => recoverableErrors.push(error),
      });
    });

    expect(container.querySelector('[data-testid="locale"]').textContent).toBe(`${locale}:${expectedText}`);
    expect(recoverableErrors).toEqual([]);
  });

  it("keeps the server locale for the first hydration render before restoring browser preferences", async () => {
    localStorage.setItem("aevotron-language", "ru");
    const app = (
      <LanguageProvider initialLanguage="en">
        <HydrationProbe />
      </LanguageProvider>
    );
    const serverMarkup = renderToString(app);
    container.innerHTML = serverMarkup;
    const recoverableErrors = [];

    await act(async () => {
      root = hydrateRoot(container, app, {
        onRecoverableError: (error) => recoverableErrors.push(error),
      });
    });

    expect(recoverableErrors).toEqual([]);
    expect(container.querySelector('[data-testid="locale"]').textContent).toBe("ru:С возвращением");
  });
});
