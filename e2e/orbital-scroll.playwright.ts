import { expect, test } from "@playwright/test";

const baseURL = process.env.BASE_URL || "http://127.0.0.1:5173";

test("orbital badge remains animated and scroll stays responsive", async ({ page }) => {
  await page.addInitScript(() => {
    (window as Window & { __longTasks?: number[] }).__longTasks = [];
    if ("PerformanceObserver" in window) {
      try {
        const observer = new PerformanceObserver((entries) => {
          const target = (window as Window & { __longTasks?: number[] }).__longTasks;
          entries.getEntries().forEach((entry) => target?.push(entry.duration));
        });
        observer.observe({ type: "longtask", buffered: true });
      } catch {
        // Long Task API is not implemented by every browser.
      }
    }
  });

  await page.goto(baseURL, { waitUntil: "networkidle" });
  const hero = page.locator(".av-hero-art");
  await expect(hero).toBeVisible();
  await expect(page.locator(".av-orbit-label").first()).toHaveCSS("animation-name", "av-label-orbit");
  await expect(page.locator(".av-orbit-label").first()).toHaveCSS("animation-play-state", "running");

  const metrics = await page.evaluate(async () => {
    const heroElement = document.querySelector(".av-hero-art");
    if (!heroElement) throw new Error("Orbital badge not found");
    const samples: number[] = [];
    let previous = performance.now();
    const started = previous;
    await new Promise<void>((resolve) => {
      const sample = (now: number) => {
        samples.push(now - previous);
        previous = now;
        if (now - started < 1500) requestAnimationFrame(sample);
        else resolve();
      };
      requestAnimationFrame(sample);
      window.scrollTo({ top: heroElement.getBoundingClientRect().top + window.scrollY, behavior: "instant" });
      setTimeout(() => window.scrollBy({ top: 160, behavior: "instant" }), 250);
    });
    const averageFrameMs = samples.reduce((sum, value) => sum + value, 0) / Math.max(samples.length, 1);
    return {
      fps: 1000 / averageFrameMs,
      longTasks: (window as Window & { __longTasks?: number[] }).__longTasks || [],
      animationState: getComputedStyle(document.querySelector(".av-orbit-label")!).animationPlayState,
    };
  });

  expect(metrics.animationState).toBe("running");
  // A 60 Hz display is physically capped near 60 FPS; allow normal scheduling variance.
  expect(metrics.fps).toBeGreaterThanOrEqual(55);
  expect(metrics.longTasks.filter((duration) => duration > 50)).toEqual([]);
});
