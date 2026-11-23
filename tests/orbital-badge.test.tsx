// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { I18nextProvider } from "react-i18next";
import { createAppI18n, changeAppLanguage } from "../src/i18n";
import { OrbitalBadge } from "../src/components/landing/OrbitalBadge";
import en from "../src/locales/landing/en.json";
import ru from "../src/locales/landing/ru.json";
import zh from "../src/locales/landing/zh.json";

describe("OrbitalBadge language updates", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let i18n: ReturnType<typeof createAppI18n>;

  beforeEach(async () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    i18n = createAppI18n({ language: "en" });
    i18n.addResourceBundle("en", "landing", en, true, true);
    i18n.addResourceBundle("ru", "landing", ru, true, true);
    i18n.addResourceBundle("zh", "landing", zh, true, true);
    await act(async () => {
      root.render(
        <I18nextProvider i18n={i18n}>
          <OrbitalBadge />
        </I18nextProvider>,
      );
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  it("updates brand and unified API copy immediately for all supported languages", async () => {
    const brand = () => container.querySelector(".av-core strong")?.textContent;
    const descriptor = () => container.querySelector(".av-core small")?.textContent;
    const monogram = () => container.querySelector(".av-core-mark")?.textContent;
    const topLabel = () => container.querySelector(".av-label-top")?.textContent;
    const bottomLabel = () => container.querySelector(".av-label-bottom")?.textContent;

    expect(brand()).toBe("AEVOTRON");
    expect(descriptor()).toBe("UNIFIED API");
    expect(monogram()).toBe("A");
    expect(topLabel()).toBe("ONE INTERFACE");
    expect(bottomLabel()).toBe("MULTIPLE MODELS");

    await act(async () => changeAppLanguage(i18n, "ru"));
    expect(brand()).toBe("AEVOTRON");
    expect(descriptor()).toBe("ЕДИНЫЙ API");
    expect(monogram()).toBe("A");
    expect(topLabel()).toBe("ЕДИНЫЙ ИНТЕРФЕЙС");
    expect(bottomLabel()).toBe("НЕСКОЛЬКО МОДЕЛЕЙ");

    await act(async () => changeAppLanguage(i18n, "zh"));
    expect(brand()).toBe("AEVOTRON");
    expect(descriptor()).toBe("统一 API");
    expect(monogram()).toBe("A");
    expect(topLabel()).toBe("统一接口");
    expect(bottomLabel()).toBe("多种模型");
  });

  it("renders all six orbit labels from translation keys", () => {
    expect(container.querySelectorAll(".av-orbit-label")).toHaveLength(6);
    expect(container.querySelector(".av-label-left")?.getAttribute("data-no-translate")).toBe("true");
    expect(container.querySelector(".av-label-right")?.getAttribute("data-no-translate")).toBe("true");
  });
});
