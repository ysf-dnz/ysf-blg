import { expect, test } from "@playwright/test";

test.describe("topluluk alanı — sekme çubuğu ve akış", () => {
  test("sekme çubuğu tüm bölümlere götürür, aktif sekme işaretli", async ({
    page,
  }) => {
    await page.goto("/topluluk");
    const nav = page.getByRole("navigation", { name: "Topluluk bölümleri" });
    await expect(nav).toBeVisible();

    // Akış aktif
    await expect(nav.getByRole("link", { name: /Akış/ })).toHaveAttribute(
      "aria-current",
      "page",
    );

    // Liderlik'e geç → aktiflik taşınır
    await nav.getByRole("link", { name: /Liderlik/ }).click();
    await expect(page).toHaveURL(/\/lider/);
    await expect(
      page
        .getByRole("navigation", { name: "Topluluk bölümleri" })
        .getByRole("link", { name: /Liderlik/ }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("misafir akışta üye-ol daveti görür, composer görmez", async ({ page }) => {
    await page.goto("/topluluk");
    await expect(page.getByText("ilk kitabın hediye")).toBeVisible();
    await expect(page.locator('form[action="/api/uye/feed"]')).toHaveCount(0);
  });

  test("375px'te yatay taşma yok", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/topluluk");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > 375 + 1,
    );
    expect(overflow).toBe(false);
  });
});
