import { test, expect } from "@playwright/test";

const MINDSET = "/kutuphane/kitap/1JlqnQCbEoW5DGVOXte4O88AdSofFbH2Z";

test.describe("kitap rafı", () => {
  test("rafta kategoriler ve kapaklı kartlar var, kart detaya gider", async ({
    page,
  }) => {
    await page.goto("/kutuphane", { waitUntil: "domcontentloaded" });
    // Not: header'daki mobil menü de <details>; raf çekmeceleri id'lidir
    const shelf = page.locator("details[id^='kat-']").first();
    await expect(shelf).toBeVisible();
    const firstBook = page.locator('a[href^="/kutuphane/kitap/"]').first();
    await expect(firstBook).toBeVisible();
    await firstBook.click();
    await expect(page).toHaveURL(/\/kutuphane\/kitap\//);
  });

  test("kitap detayında çekmeceler açılıp kapanır", async ({ page }) => {
    await page.goto(MINDSET, { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /Mindset/, level: 1 }),
    ).toBeVisible();

    const drawer = page.locator("main details").first();
    const answer = drawer.locator(".prose");
    await expect(answer).not.toBeVisible();
    await drawer.locator("summary").click();
    await expect(answer).toBeVisible();
    await expect(answer).toContainText(/zihniyet/i);
  });

  test("misafire Drive İÇERİĞİ sızmaz: kilit kartı var, okuma iframe'i yok", async ({
    page,
  }) => {
    // Platform sonrası gerçek: okuma embed'i yalnızca erişimi olan üyeye
    // render edilir; misafir kilit kartı + katıl CTA'sı görür.
    await page.goto(MINDSET, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Bu bilgi seni bekliyor")).toBeVisible();
    await expect(
      page.locator("iframe[src*='drive.google.com']"),
    ).toHaveCount(0);
  });

  test("NotebookLM sohbeti kilidin ardında: misafire link verilmez", async ({
    page,
  }) => {
    // Değişiklik bilinçli: defter linki kitabın TAM METNİ üzerinden soru
    // sormayı sağlar. Statik sayfada durursa misafir kitabı hiç açmadan
    // içeriğe erişirdi. Artık yalnız erişimi olana, Okuma Kapısı adasında
    // sunucu tarafında render edilir.
    await page.goto(MINDSET, { waitUntil: "domcontentloaded" });
    await expect(
      page.locator("a[href*='notebooklm.google.com']"),
    ).toHaveCount(0);
    // Vitrin metni yine görünür (kilidin ardındaki fayda anlatılır)
    await expect(page.getByText("Bu bilgi seni bekliyor")).toBeVisible();
  });
});
