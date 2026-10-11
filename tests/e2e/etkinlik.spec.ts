import { expect, test } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

// seed:demo — yaklaşan etkinlik (kontenjan 40) ve Elif'in etkinlik daveti DEMEV01
const YAKLASAN = "/etkinlik/canli-quiz-gecesi-demo";

// Auth projesi (seri, tek worker). Test üyesi global-setup'ta açılır. Dev = canlı DB:
// kayıtlar koşumlar arasında KALIR → her adım "ilk koşum" ve "tekrar koşum" dallarını tanır.
test.describe("etkinlik akışı — üye", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!process.env.E2E_CLERK_USER, "CLERK_SECRET_KEY yok — auth e2e atlandı");
    await page.goto("/");
    await clerk.signIn({ page, emailAddress: process.env.E2E_CLERK_USER! });
  });

  test("F3-03: davetle gelen üye tek dokunuşla kaydolur; kayıt kutusu 'Kayıtlısın' olur", async ({ page }) => {
    const r = await page.request.get("/d/demev01", { maxRedirects: 0 }); // çerez bu context'e
    expect(r.status()).toBe(302);
    await page.goto(`${YAKLASAN}?d=DEMEV01`, { waitUntil: "domcontentloaded" });
    const bant = page.locator("[data-davet-bandi]");
    if (await bant.isVisible()) {
      await bant.getByRole("button", { name: /Yerimi ayır/ }).click();
      await expect(page).toHaveURL(/sonuc=yeni&davet=1/);
      await expect(page.getByText(/Davetle yerin ayrıldı/)).toBeVisible();
    }
    await page.goto(YAKLASAN, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-kayit-kutusu]").getByText(/Kayıtlısın/)).toBeVisible();
    await expect(page.locator("[data-davet-bandi]")).toHaveCount(0);
    // Üyeye katılımcı listesi görünür, düzenleyen paneli görünmez
    await expect(page.getByRole("heading", { name: /Katılımcılar/ })).toBeVisible();
    await expect(page.getByText("Düzenleyen paneli")).toHaveCount(0);
  });

  test("F3-03: kayıtlı üye kendi etkinlik davet kartını görür (QR, link, not) ve Davetlerim'de listelenir", async ({ page }) => {
    await page.goto(`${YAKLASAN}#davet`, { waitUntil: "domcontentloaded" });
    const kart = page.locator("#davet");
    await expect(kart).toBeVisible();
    await expect(kart.locator("svg")).toHaveCount(1); // QR sunucuda SVG
    await expect(kart.getByRole("link", { name: /Hikâye/ })).toHaveAttribute("href", /\/api\/kart\/[0-9A-Z]{7}\/story\.png/);
    await kart.locator('input[name="note"]').fill("e2e etkinlik notu");
    await kart.getByRole("button", { name: /Kaydet/ }).click();
    await expect(page.locator('#davet input[name="note"]')).toHaveValue("e2e etkinlik notu");
    await page.goto("/uye", { waitUntil: "domcontentloaded" });
    const davetlerim = page.locator("section", { has: page.getByRole("heading", { level: 2, name: /Davetlerim/ }) });
    await expect(davetlerim.getByRole("link", { name: /Canlı Quiz Gecesi/ })).toHaveAttribute("href", `${YAKLASAN}#davet`);
  });
});
