import { expect, test } from "@playwright/test";

const KURS = "/kurslar/sifirdan-go-learning-go-yol-haritasi-demo"; // seed:demo

test.describe("kurslar — misafir (mıknatıs) ve yönlendirmeler", () => {
  test("AC-1: /kurslar misafire açık, demo kurs listede", async ({ page }) => {
    await page.goto("/kurslar", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: /Kurslar/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Sıfırdan Go/ }).first()).toBeVisible();
    // Misafir CTA: ilk kitabın hediye
    await expect(page.getByText(/ilk kitabın hediye/).first()).toBeVisible();
  });

  test("AC-1: misafir ilk öğeyi görür, ikinci öğe kilitli", async ({ page }) => {
    await page.goto(KURS, { waitUntil: "domcontentloaded" });
    await expect(page.locator("iframe[src*='youtube-nocookie']")).toHaveCount(1);
    // <script> innerText boş olduğu için hasText çalışmaz → textContent ile bak
    const courseLd = await page.evaluate(() =>
      Array.from(document.querySelectorAll('script[type="application/ld+json"]')).filter((s) =>
        (s.textContent ?? "").includes('"@type":"Course"'),
      ).length,
    );
    expect(courseLd).toBe(1);
    await page.goto(`${KURS}?b=1`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("iframe[src*='youtube-nocookie']")).toHaveCount(0);
    await expect(page.getByText(/Bu öğe üyelere açık/)).toBeVisible();
    // Üye yazısı gövdesi misafir DOM'unda yok
    await expect(page.locator("article.prose")).toHaveCount(0);
  });

  test("AC-2: /dersler ve /egitim/[id] 301 ile yeni adrese gider", async ({ page, request }) => {
    const r1 = await request.get("/dersler", { maxRedirects: 0 });
    expect(r1.status()).toBe(301);
    expect(r1.headers()["location"]).toMatch(/\/kurslar$/);
    // id → slug (DB çözümü), ?b korunur; bozuk/olmayan id → /kurslar
    await page.goto(KURS, { waitUntil: "domcontentloaded" });
    const id = await page.locator("header[data-kurs-id]").getAttribute("data-kurs-id");
    const r2 = await request.get(`/egitim/${id}?b=1`, { maxRedirects: 0 });
    expect(r2.status()).toBe(301);
    expect(r2.headers()["location"]).toBe(`${KURS}?b=1`);
    for (const bozuk of ["0", "1e400", "abc"]) {
      const r3 = await request.get(`/egitim/${bozuk}`, { maxRedirects: 0 });
      expect(r3.status()).toBe(301);
      expect(r3.headers()["location"]).toMatch(/\/kurslar$/);
    }
    const liste = await request.get("/sitemap-kurslar.xml");
    expect(liste.status()).toBe(200);
    expect(await liste.text()).toContain(KURS);
  });

  test("AC-1: sitemap üye alanını listelemez, kurs sitemap'ini listeler", async ({ request }) => {
    const r = await request.get("/sitemap-kurslar.xml");
    expect(r.headers()["content-type"]).toContain("xml");
    const xml = await r.text();
    expect(xml).toContain("/kurslar</loc>");
    expect(xml).not.toContain("/uye");
  });

  test("375px'te kurs sayfasında yatay taşma yok", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(KURS, { waitUntil: "domcontentloaded" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > 375 + 1);
    expect(overflow).toBe(false);
  });
});
