import { test, expect } from "@playwright/test";

/**
 * Kalite kapısı (platform sonrası güncellendi): script'ler yalnızca
 * BİLİNEN kaynaklardan gelebilir. Clerk (auth) ve Vercel Analytics
 * bilinçli istisnadır; tanınmayan üçüncü taraf = ihlal.
 * Not: dev-server'da Vite/toolbar modülleri localhost'tan gelir.
 */
const IZINLI_KAYNAK =
  /^(https?:\/\/localhost:4321|blob:|https:\/\/[\w-]+\.clerk\.accounts\.dev|https:\/\/clerk\.|https:\/\/cdn\.vercel-insights\.com|\/_vercel\/insights)/;

test.describe("client JS bütçesi", () => {
  test("yazı sayfası tanınmayan üçüncü taraf script yüklemez", async ({
    page,
  }) => {
    const ihlaller: string[] = [];
    page.on("request", (req) => {
      if (req.resourceType() === "script" && !IZINLI_KAYNAK.test(req.url()))
        ihlaller.push(req.url());
    });
    await page.goto("/yazilar/merhaba-dunya", { waitUntil: "networkidle" });
    expect(ihlaller, `beklenmeyen kaynaklar: ${ihlaller.join(", ")}`).toHaveLength(0);
  });

  test("D3'lü yazıda grafik çizilir, yabancı kaynak inmez", async ({ page }) => {
    const ihlaller: string[] = [];
    page.on("request", (req) => {
      if (req.resourceType() === "script" && !IZINLI_KAYNAK.test(req.url()))
        ihlaller.push(req.url());
    });
    await page.goto("/yazilar/notebooklm-ile-ogrenme", {
      waitUntil: "networkidle",
    });
    await page.locator(".d3-chart").scrollIntoViewIfNeeded();
    // d3 chunk'ının dev'de ilk derlemesi yavaş olabilir
    await expect(page.locator(".d3-chart svg")).toBeVisible({ timeout: 25_000 });
    expect(ihlaller, `beklenmeyen kaynaklar: ${ihlaller.join(", ")}`).toHaveLength(0);
  });
});
