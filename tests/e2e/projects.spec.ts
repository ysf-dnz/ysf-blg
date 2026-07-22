import { test, expect } from "@playwright/test";

test.describe("projeler", () => {
  test("liste sayfası projeleri gösterir, kart detaya gider", async ({
    page,
  }) => {
    await page.goto("/projeler");
    await expect(
      page.getByRole("heading", { name: "Projeler", level: 1 }),
    ).toBeVisible();
    const card = page.locator('a[href^="/projeler/"]').first();
    await expect(card).toBeVisible();
    await card.click();
    await expect(page).toHaveURL(/\/projeler\/[\w-]+/);
  });

  test("detay sayfasında künye ve markdown gövde var", async ({ page }) => {
    await page.goto("/projeler/kutuphanem");
    await expect(
      page.getByRole("heading", { name: /Kütüphanem/, level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Siteye git/ })).toHaveAttribute(
      "href",
      /ysf-dnz\.github\.io/,
    );
    await expect(page.locator(".prose")).toContainText(/NotebookLM/);
  });

  test("nav'da Projeler linki var, EN aynası çalışır", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("navigation", { name: "Ana menü" })
      .getByRole("link", { name: "Projeler" })
      .click();
    await expect(page).toHaveURL("/projeler");

    await page.goto("/en/projeler");
    await expect(
      page.getByRole("heading", { name: "Projects", level: 1 }),
    ).toBeVisible();
  });

  test("footer'da sosyal linkler panel sırasıyla görünür", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    await expect(footer.locator('a[href^="mailto:"]')).toBeVisible();
    await expect(footer.locator('a[href="/rss.xml"]').first()).toBeVisible();
  });
});
