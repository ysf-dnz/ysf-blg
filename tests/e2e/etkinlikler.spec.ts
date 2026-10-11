import { expect, test } from "@playwright/test";

// seed:demo — yaklaşan (kontenjan 40), devam eden (çevrimiçi maraton), bitmiş (tanışma)
const YAKLASAN = "/etkinlik/canli-quiz-gecesi-demo";
const MARATON = "/etkinlik/go-okuma-maratonu-demo";
const BITMIS = "/etkinlik/tanisma-bulusmasi-demo";

test.describe("etkinlik sayfası — misafir (F3-02)", () => {
  test("liste etkinlik sayfalarına götürür; kontenjan ve geçmiş bölümü görünür", async ({ page }) => {
    await page.goto("/etkinlikler", { waitUntil: "domcontentloaded" });
    const kart = page.locator("[data-etkinlikler] li", { hasText: "Canlı Quiz Gecesi" });
    await expect(kart.getByRole("link")).toHaveAttribute("href", YAKLASAN);
    await expect(kart).toContainText(/\d+ \/ 40 kayıtlı/);
    await expect(page.getByRole("link", { name: /Dönem Açılışı Tanışma Buluşması/ })).toHaveAttribute("href", BITMIS);
    // RSVP artık puan vaat etmez: puan doğrulanmış girişte
    await expect(page.getByText(/girişini doğrulat/).first()).toBeVisible();
  });

  test("etkinlik sayfası herkese açık: tarih, kontenjan, düzenleyen, Event JSON-LD, tek kayıt butonu", async ({ page }) => {
    const yanit = await page.goto(YAKLASAN, { waitUntil: "domcontentloaded" });
    expect(yanit?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: /Canlı Quiz Gecesi/ })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Topluluk bölümleri" });
    await expect(nav.getByRole("link", { name: /Etkinlikler/ })).toHaveAttribute("aria-current", "page");
    await expect(page.locator("[data-kayit-kutusu]")).toContainText(/\d+ \/ 40/);
    await expect(page.getByText("Ayşe Demir").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Yerimi ayır/ })).toHaveCount(1);
    // Sayfada site geneli JSON-LD de var: Event olanı seç
    const bloklar = await page.locator('script[type="application/ld+json"]').allTextContents();
    const ld = bloklar.map((b) => JSON.parse(b)).find((b) => b["@type"] === "Event");
    expect(ld).toBeTruthy();
    expect(ld.maximumAttendeeCapacity).toBe(40);
    expect(new Date(ld.endDate).getTime() - new Date(ld.startDate).getTime()).toBe(2 * 3600_000);
    // Misafire katılımcı listesi ve düzenleyen paneli yok
    await expect(page.getByText("Düzenleyen paneli")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Katılımcılar/ })).toHaveCount(0);
  });

  test("bitmiş etkinlikte kayıt butonu yok; olmayan etkinlik 404", async ({ page, request }) => {
    await page.goto(BITMIS, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Sona erdi").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Yerimi ayır/ })).toHaveCount(0);
    expect((await request.get("/etkinlik/yok-boyle-etkinlik")).status()).toBe(404);
  });

  test("takvime ekle: .ics indirilebilir ve UTC anlar taşır", async ({ request }) => {
    const r = await request.get(`${YAKLASAN}/takvim.ics`);
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toContain("text/calendar");
    const ics = await r.text();
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toMatch(/DTSTART:\d{8}T\d{6}Z/);
    expect(ics).toContain("SUMMARY:Canlı Quiz Gecesi: Learning Go");
    expect((await request.get("/etkinlik/yok-boyle-etkinlik/takvim.ics")).status()).toBe(404);
  });

  test("etkinlik sitemap'i herkese açık etkinlikleri listeler", async ({ request }) => {
    const r = await request.get("/sitemap-etkinlikler.xml");
    expect(r.status()).toBe(200);
    const xml = await r.text();
    for (const yol of [YAKLASAN, MARATON, BITMIS]) expect(xml).toContain(`${yol}</loc>`);
  });

  test("F3-04: misafir giriş ekranını ve bilet doğrulamasını göremez; imzasız bilet 404", async ({ request }) => {
    expect((await request.get(`${YAKLASAN}/giris`)).status()).toBe(404);
    expect((await request.get("/t/q/1.AAAAAAAAAAAAAAAA")).status()).toBe(404);
    expect((await request.get("/t/q/bozuk")).status()).toBe(404);
    // /T/ büyük harf QR yolu her zaman /t/q/'ya iner (aynı yola 301 canlıda sonsuz döngü olurdu)
    const r = await request.get("/T/1.AAAAAAAAAAAAAAAA", { maxRedirects: 0 });
    expect(r.status()).toBe(301);
    expect(r.headers()["location"]).toBe("/t/q/1.AAAAAAAAAAAAAAAA");
  });

  test("F3-05: dönen QR yolu — /C/ 301'i /c/q/'ya iner; misafir giriş ister, giriş yazılmaz; ekran misafire yok", async ({ page, request }) => {
    const r = await request.get("/C/1/ABCDE12345", { maxRedirects: 0 });
    expect(r.status()).toBe(301);
    expect(r.headers()["location"]).toBe("/c/q/1/ABCDE12345");
    expect((await request.get("/c/q/999999999/ABCDE12345")).status()).toBe(404);
    expect((await request.get("/c/q/bozuk/ABCDE12345")).status()).toBe(404);
    expect((await request.get(`${MARATON}/ekran`)).status()).toBe(404);
    await page.goto(MARATON, { waitUntil: "domcontentloaded" });
    const id = await page.locator("[data-etkinlik-id]").getAttribute("data-etkinlik-id");
    await page.goto(`/c/q/${id}/ABCDE12345`, { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-donen="giris"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Giriş yap" })).toBeVisible();
  });

  test("F3-06: biten etkinlikte değerlendirme ortalaması herkese görünür; form ve katılım listesi misafire yok", async ({ page, request }) => {
    await page.goto(BITMIS, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-etkinlik-puan]")).toHaveText("⭐ 4,5 · 2 değerlendirme"); // seed: 5 ve 4
    await expect(page.locator("#degerlendir")).toHaveCount(0);
    expect((await request.get(`${BITMIS}/katilimcilar.csv`)).status()).toBe(404);
    const bloklar = await page.locator('script[type="application/ld+json"]').allTextContents();
    const ld = bloklar.map((b) => JSON.parse(b)).find((b) => b["@type"] === "Event");
    expect(ld.aggregateRating).toMatchObject({ ratingValue: "4.5", ratingCount: 2 });
  });

  test("375px'te yatay taşma yok", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(YAKLASAN, { waitUntil: "domcontentloaded" });
    const tasma = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(tasma).toBeLessThanOrEqual(1);
  });
});
