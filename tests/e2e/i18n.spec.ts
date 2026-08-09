import { test, expect } from "@playwright/test";

test.describe("i18n routing", () => {
  test("TR prefix'siz, EN /en prefix'li ve lang attribute'ları doğru", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "tr");

    await page.goto("/en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("h1").first()).toContainText(/future/i);
  });

  test("çevirisi olan yazıda dil değiştirici görünür", async ({ page }) => {
    await page.goto("/yazilar/merhaba-dunya");
    const switcher = page.getByRole("link", { name: /Read in English/i });
    await expect(switcher).toBeVisible();
    await switcher.click();
    await expect(page).toHaveURL(/\/en\/yazilar\/hello-world/);
    await expect(
      page.getByRole("link", { name: /Türkçe oku/i }),
    ).toBeVisible();
  });

  test("çevirisi olmayan yazıda dil değiştirici görünmez", async ({ page }) => {
    await page.goto("/yazilar/notebooklm-ile-ogrenme");
    await expect(
      page.getByRole("link", { name: /Read in English/i }),
    ).toHaveCount(0);
  });

  test("hreflang çiftleri simetrik", async ({ page }) => {
    await page.goto("/yazilar/merhaba-dunya");
    const hreflangs = await page
      .locator('link[rel="alternate"][hreflang]')
      .evaluateAll((els) => els.map((el) => el.getAttribute("hreflang")));
    expect(hreflangs.sort()).toEqual(["en", "tr", "x-default"]);
  });
});
