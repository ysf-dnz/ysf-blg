import { expect, test } from "@playwright/test";

const KITAP = "/kutuphane/kitap/1h6nwQ-jHvqKuCtpiP3kdb5GsBtOcPww6"; // Learning Go

test.describe("kitap erişim kapısı (misafir)", () => {
  test("kilit kartı ve hediye CTA'sı görünür", async ({ page }) => {
    await page.goto(KITAP);
    await expect(page.getByText("Bu bilgi seni bekliyor")).toBeVisible();
    await expect(page.getByText(/ilk kitabın hediye/).first()).toBeVisible();
  });

  test("abonelik/indirme planları tamamen kaldırıldı", async ({ page }) => {
    await page.goto(KITAP, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("İndirme Planları")).toHaveCount(0);
    await expect(page.getByText(/Günde \d+ kitaba kadar/)).toHaveCount(0);
  });

  test("💎 değer kartı görünür (deger-notlari.json'lu kitapta)", async ({ page }) => {
    await page.goto("/kutuphane/kitap/1JlqnQCbEoW5DGVOXte4O88AdSofFbH2Z", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByText("Bu kitap sana ne katacak?")).toBeVisible();
  });

  test("KRİTİK: Drive okuma embed'i misafirin DOM'una hiç gelmez (sızıntı yok)", async ({
    page,
  }) => {
    await page.goto(KITAP);
    await expect(page.locator('iframe[src*="drive.google.com"]')).toHaveCount(0);
    // Lazy-load edilen embed düğmeleri de olmamalı
    const html = await page.content();
    expect(html).not.toContain("drive.google.com/file");
  });
});
