import { test, expect } from "@playwright/test";

/**
 * Kalite kapısı: yazı sayfasında D3 island dışında harici script inmemeli
 * (tema/TOC/kopyala inline'dır; Pagefind ve Giscus lazy'dir).
 * Tek bilinçli istisna: Vercel Web Analytics (~1KB, adapter enjekte eder).
 */
const IZINLI = /\/_vercel\/insights\//;

test.describe("client JS bütçesi", () => {
  test("düz yazı sayfası sıfır harici script yükler", async ({ page }) => {
    const scripts: string[] = [];
    page.on("request", (req) => {
      if (req.resourceType() === "script" && !IZINLI.test(req.url()))
        scripts.push(req.url());
    });
    await page.goto("/yazilar/merhaba-dunya", { waitUntil: "networkidle" });
    expect(scripts, `beklenmeyen scriptler: ${scripts.join(", ")}`).toHaveLength(0);
  });

  test("D3'lü yazıda yalnızca chart chunk'ları iner", async ({ page }) => {
    const scripts: string[] = [];
    page.on("request", (req) => {
      if (req.resourceType() === "script" && !IZINLI.test(req.url()))
        scripts.push(req.url());
    });
    await page.goto("/yazilar/notebooklm-ile-ogrenme", {
      waitUntil: "networkidle",
    });
    // grafik viewport'a girince d3 chunk'ı gelir; hepsi _astro altından olmalı
    for (const url of scripts) {
      expect(url).toContain("/_astro/");
    }
    // grafik gerçekten çizilmiş mi
    await page
      .locator(".d3-chart")
      .scrollIntoViewIfNeeded();
    await expect(page.locator(".d3-chart svg")).toBeVisible({ timeout: 10_000 });
  });
});
