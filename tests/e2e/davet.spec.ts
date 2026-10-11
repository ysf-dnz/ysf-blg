import { expect, test } from "@playwright/test";

const KURS = "/kurslar/sifirdan-go-learning-go-yol-haritasi-demo"; // seed:demo
const KOD = "DEM07KQ"; // seed:demo — Ayşe'nin kurs daveti

test.describe("kurs daveti — misafir karşılama (Faz 2)", () => {
  test("AC-12: /d/{kod} küçük harf ve /D/{KOD} aynı daveti açar; çerezler kurulur", async ({ request }) => {
    const r1 = await request.get(`/d/${KOD.toLowerCase()}`, { maxRedirects: 0 });
    expect(r1.status()).toBe(302);
    expect(r1.headers()["location"]).toBe(`${KURS}?d=${KOD}`);
    const cerezler = r1.headersArray().filter((h) => h.name.toLowerCase() === "set-cookie").map((h) => h.value);
    expect(cerezler.some((c) => c.startsWith("ysf_davet=course%3A") || c.startsWith("ysf_davet=course:"))).toBe(true);
    expect(cerezler.some((c) => c.startsWith("ysf_ref=ayse-demir"))).toBe(true);
    // Büyük harf QR yolu: 301 → /d/q/… → 302
    const r2 = await request.get(`/D/${KOD}`, { maxRedirects: 0 });
    expect(r2.status()).toBe(301);
    expect(r2.headers()["location"]).toBe(`/d/q/${KOD}`);
    const r3 = await request.get(`/d/q/${KOD}`, { maxRedirects: 0 });
    expect(r3.status()).toBe(302);
    expect(r3.headers()["location"]).toBe(`${KURS}?d=${KOD}`);
    // Alt-kaynak isteği (img) çerez kuramaz ve ziyaret sayılmaz
    const r5 = await request.get(`/d/${KOD}`, { maxRedirects: 0, headers: { "sec-fetch-dest": "image" } });
    expect(r5.status()).toBe(204);
    expect(r5.headersArray().some((h) => h.name.toLowerCase() === "set-cookie")).toBe(false);
    // O→0, I→1 normalizasyonu: "DEMO7KQ" da aynı koda çözülür
    const r4 = await request.get(`/d/DEMO7KQ`, { maxRedirects: 0 });
    expect(r4.headers()["location"]).toBe(`${KURS}?d=${KOD}`);
  });

  test("geçersiz kod kurs listesine düşer, 500 vermez", async ({ request }) => {
    const r = await request.get("/d/ZZZZZZZ", { maxRedirects: 0 });
    expect(r.status()).toBe(302);
    expect(r.headers()["location"]).toMatch(/\/kurslar\?davet=gecersiz$/);
    const r2 = await request.get("/d/x", { maxRedirects: 0 });
    expect(r2.status()).toBe(302);
  });

  test("karşılama sayfası: '{Ad} seni davet ediyor', puan rozeti, tek buton, OG kart", async ({ page }) => {
    await page.goto(`${KURS}?d=${KOD}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/Ayşe Demir seni bu kursa davet ediyor/)).toBeVisible();
    await expect(page.getByText(/sen \+10/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Kursa katıl/ }).first()).toBeVisible();
    const og = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(og).toContain(`/api/kart/${KOD}/og.png`);
    // Davet sayfası indekslenmez (kişisel kart)
    await expect(page.locator('meta[name="robots"][content="noindex"]')).toHaveCount(1);
  });

  test("davetli uygulama içi tarayıcıda e-posta kodu ipucu görür", async ({ browser }) => {
    const ctx = await browser.newContext({
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Instagram 300.0",
    });
    const page = await ctx.newPage();
    await page.goto(`${KURS}?d=${KOD}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/Uygulama içi tarayıcıdasın/)).toBeVisible();
    await ctx.close();
  });
});
