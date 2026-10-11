import { expect, test } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

const KURS = "/kurslar/sifirdan-go-learning-go-yol-haritasi-demo"; // seed:demo

// Auth projesi (seri, tek worker). Test üyesi global-setup'ta açılır.
test.describe("kurs akışı — üye", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!process.env.E2E_CLERK_USER, "CLERK_SECRET_KEY yok — auth e2e atlandı");
    await page.goto("/");
    await clerk.signIn({ page, emailAddress: process.env.E2E_CLERK_USER! });
  });

  test("katıl → ilk öğeyi tamamla → ilerleme ve aktivasyon görünür (idempotent)", async ({ page }) => {
    await page.goto(KURS);
    const katil = page.getByRole("button", { name: /Kursa katıl/ }).first();
    if (await katil.isVisible()) {
      await katil.click();
      await expect(page).toHaveURL(/katildin=1/);
      await expect(page.getByText(/Kursa katıldın/)).toBeVisible();
    }
    // İlk öğe: tamamlanmamışsa işaretle (tekrar koşumda zaten ✅ olabilir)
    await page.goto(`${KURS}?b=0`);
    const tamamla = page.getByRole("button", { name: /Tamamlandı işaretle/ });
    if (await tamamla.isVisible()) {
      await tamamla.click();
      await expect(page).toHaveURL(/b=1/); // next → sonraki öğe
    }
    await page.goto(KURS);
    // Aside'da en az bir ✅ ve ilerleme çubuğu; "ilk öğeyi bitirince aktive olur" notu artık YOK
    await expect(page.locator("aside li").filter({ hasText: "✅" }).first()).toBeVisible();
    await expect(page.getByText(/ilk öğeyi bitirince kurs aktive olur/)).toHaveCount(0);
    await expect(page.getByText(/\d+\/\d+ öğe/)).toBeVisible();
  });

  test("soru-cevap formu üyeye görünür, ikinci öğe üyeye açık", async ({ page }) => {
    await page.goto(`${KURS}?b=1`);
    await expect(page.getByText(/Bu öğe üyelere açık/)).toHaveCount(0);
    await expect(page.locator('form[action="/api/uye/feed"] textarea[name="body"]')).toBeVisible();
  });

  test("pano: Bekleyen puan bölümü hatasız render olur", async ({ page }) => {
    const r = await page.goto("/uye");
    expect(r?.status()).toBe(200);
    // Yeni üyenin panosunda bölümler değişken; hatasız render + başlık yeter
    await expect(page.locator("h1").first()).toContainText(/.+/);
    await expect(page.getByText(/Bekleyen puan|Bilgi Hazine|puan/i).first()).toBeVisible();
  });
});

test.describe("kurs daveti — üye (Faz 2)", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!process.env.E2E_CLERK_USER, "CLERK_SECRET_KEY yok — auth e2e atlandı");
    await page.goto("/");
    await clerk.signIn({ page, emailAddress: process.env.E2E_CLERK_USER! });
  });

  test("katılmış üye davet kartını, QR'ı ve indirme linklerini görür; not kaydeder", async ({ page }) => {
    await page.goto(KURS, { waitUntil: "domcontentloaded" });
    const katil = page.getByRole("button", { name: /Kursa katıl/ }).first();
    if (await katil.isVisible()) await katil.click();
    await page.goto(`${KURS}#davet`, { waitUntil: "domcontentloaded" });
    const kart = page.locator("#davet");
    await expect(kart).toBeVisible();
    await expect(kart.locator("svg")).toHaveCount(1); // QR sunucuda SVG
    await expect(kart.getByRole("link", { name: /Hikâye/ })).toHaveAttribute("href", /\/api\/kart\/[0-9A-Z]{7}\/story\.png/);
    await kart.locator('input[name="note"]').fill("e2e notu");
    await kart.getByRole("button", { name: /Kaydet/ }).click();
    await expect(page.locator('#davet input[name="note"]')).toHaveValue("e2e notu");
  });

  test("Davetlerim panoda görünür", async ({ page }) => {
    await page.goto("/uye", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 2, name: /Davetlerim/ })).toBeVisible();
  });
});
