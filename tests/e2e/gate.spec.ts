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
    // ÖNCE adanın çözülmesini bekle: server:defer içeriği asenkron gelir,
    // beklemeden yapılan sayım ada sızdırsa bile 0 görüp yanlış GEÇERDİ.
    await expect(page.getByText("Bu bilgi seni bekliyor")).toBeVisible();
    await expect(page.locator('iframe[src*="drive.google.com"]')).toHaveCount(0);
    // Lazy-load edilen embed düğmeleri de olmamalı
    const html = await page.content();
    expect(html).not.toContain("drive.google.com/file");
  });

  test("KRİTİK: ?acildi=1 misafire indirme linki VERMEZ (kutlama bandı açılmaz)", async ({
    page,
  }) => {
    await page.goto(`${KITAP}?acildi=1`);
    await expect(page.getByText("Bu bilgi seni bekliyor")).toBeVisible();
    // Bant DOM'da durur ama yalnız /api/uye/kitap-linkler 200 dönerse AÇILIR;
    // misafir yetkisiz yanıt alır → bant gizli kalır, linkler hiç kurulmaz.
    await expect(page.locator("#acildi-band")).toBeHidden();
    await expect(page.locator("#acildi-indir")).toBeHidden();
    await expect(page.locator("#acildi-oku")).toBeHidden();
    const html = await page.content();
    expect(html).not.toContain("drive.google.com/uc");
    expect(html).not.toContain("drive.google.com/file");
  });

  test("KRİTİK: ?hediye=1 de misafire Drive linki vermez", async ({ page }) => {
    await page.goto(`${KITAP}?hediye=1`);
    await expect(page.getByText("Bu bilgi seni bekliyor")).toBeVisible();
    await expect(page.locator("#hediye-band")).toBeHidden();
    await expect(page.locator("#hediye-drive")).toBeHidden();
    const html = await page.content();
    expect(html).not.toContain("drive.google.com/file");
  });

  test("KRİTİK: kitap-linkler ucu misafire içerik sızdırmaz", async ({ request }) => {
    // maxRedirects:0 — yönlendirme takip edilirse Clerk giriş sayfası 200 döner
    // ve testi yanlış yere GEÇİRİRDİ. Bizi ilgilendiren ucun KENDİ yanıtı.
    const yanit = await request.get(
      "/api/uye/kitap-linkler?bookId=1h6nwQ-jHvqKuCtpiP3kdb5GsBtOcPww6",
      { maxRedirects: 0 },
    );
    // Yetkisiz: ya doğrudan reddedilir (401/403) ya girişe yönlendirilir (3xx)
    expect(yanit.status()).toBeGreaterThanOrEqual(300);
    expect(await yanit.text()).not.toContain("drive.google.com");
  });

  test("NotebookLM sohbet linki kilidin ardında (misafirde yok)", async ({ page }) => {
    await page.goto(KITAP);
    await expect(page.getByText("Bu bilgi seni bekliyor")).toBeVisible();
    const html = await page.content();
    expect(html).not.toContain("notebooklm.google.com");
  });
});
