import { expect, test } from "@playwright/test";

test.describe("akış yönlendirmeleri (misafir)", () => {
  test("korumalı /uye Clerk girişine yönlendirir", async ({ page }) => {
    await page.goto("/uye");
    await page.waitForURL(/accounts\.dev|clerk/, { timeout: 15_000 });
    expect(page.url()).toMatch(/accounts\.dev|clerk/);
  });

  test("ana sayfa: gelecek anlatısı + hediye CTA'sı", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Bilgi burada ödüldür")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /ilk kitabın hediye/ }),
    ).toBeVisible();
    await expect(page.getByText("1 · Oku")).toBeVisible();
  });

  test("harita: SVG + kulüp-kur CTA'sı render olur", async ({ page }) => {
    await page.goto("/harita");
    await expect(
      page.getByRole("img", { name: "Türkiye üye ve kulüp haritası" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Şehrinde kulüp yok mu/ }),
    ).toBeVisible();
  });

  test("kulüp kurma sayfası misafiri üyeliğe yönlendirir", async ({ page }) => {
    await page.goto("/kulup-kur");
    await expect(page.getByText(/önce üye ol/)).toBeVisible();
  });
});
