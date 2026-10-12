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

  test("harita: Leaflet + OSM, il rozetleri, kulüp-kur CTA'sı; popup DOM'la kurulur ve mobilde görünür kalır", async ({ page }) => {
    await page.route("**/tile.openstreetmap.org/**", (r) => r.abort()); // OSMF karo sunucusunu testte yorma
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/harita");
    await expect(page.getByRole("region", { name: "Türkiye üye ve kulüp haritası" })).toBeVisible();
    await expect(page.locator(".leaflet-container")).toBeVisible();
    await expect(page.getByRole("link", { name: /Şehrinde kulüp yok mu/ })).toBeVisible();
    await expect(page.locator(".leaflet-control-attribution")).toContainText("OpenStreetMap"); // atıf zorunlu (OSMF karo politikası); küçük+yarı saydam
    await expect(page.locator("path.il-sinir")).toHaveCount(81); // OSM il sınırları (choropleth)
    expect(await page.locator("path.il-sinir-1, path.il-sinir-2").count()).toBeGreaterThan(0); // kulüplü il tonlu
    const rozet = page.locator(".harita-rozet-kulup").first(); // seed:demo → Ankara / İzmir
    await expect(rozet).toBeVisible();
    await rozet.click();
    const popup = page.locator(".leaflet-popup");
    await expect(popup.locator("a[href^='/kulup/']").first()).toBeVisible();
    // Popup harita kutusunun içinde tamamen görünür (autoPan) — eski SVG popover'ı overflow-hidden'da kesiliyordu
    // Yaklaşan etkinliklerle uzayan popup için autoPan animasyonu sürer → oturana kadar yokla
    await expect
      .poll(async () => {
        const [p, h] = await Promise.all([popup.boundingBox(), page.locator("#harita").boundingBox()]);
        return !!(p && h && p.y >= h.y && p.y + p.height <= h.y + h.height && p.x >= h.x && p.x + p.width <= h.x + h.width);
      })
      .toBe(true);
  });

  test("harita (F4-02 · AC-21): misafire üye ızgarası gömülmez, filtre yok; il popup'ında yaklaşan etkinlikler", async ({ page }) => {
    await page.route("**/tile.openstreetmap.org/**", (r) => r.abort());
    await page.goto("/harita?topluluk=odtu-yz-okuma-demo&takip=1"); // misafirde filtre parametresi etkisiz
    await expect(page.locator("[data-harita-misafir]")).toContainText("giriş yap");
    await expect(page.locator("[data-harita-filtre]")).toHaveCount(0);
    const veri = JSON.parse((await page.locator("#harita-veri").textContent()) ?? "{}");
    expect(veri.bakan).toBeNull();
    expect(veri.filtreli).toBe(false);
    // Rıza verenler dahil HİÇBİR üye bireysel olarak sayfa kaynağında yok (ızgara yalnız girişli üyeye)
    expect(veri.pinler.every((p: { uyeler: unknown[]; gorunen: number }) => p.uyeler.length === 0 && p.gorunen === 0)).toBe(true);
    for (const h of ["elif-celik", "ayse-demir", "mehmet-kaya"]) expect(JSON.stringify(veri)).not.toContain(h);
    expect(veri.pinler.find((p: { il: string }) => p.il === "İstanbul").uye).toBeGreaterThanOrEqual(2); // anonim il sayımı kalır
    // seed:demo: Ankara'da yaklaşan quiz gecesi (biten buluşma ve il'siz site geneli maraton haritada yok)
    await page.locator('.leaflet-marker-icon[title^="Ankara:"]').click();
    const popup = page.locator(".leaflet-popup");
    await expect(popup.getByText("Yaklaşan etkinlikler")).toBeVisible();
    await expect(popup.locator('a[href="/etkinlik/canli-quiz-gecesi-demo"]')).toBeVisible();
    await expect(popup.locator("[data-harita-uyeler]")).toHaveCount(0);
  });

  test("kulüp kurma sayfası misafiri üyeliğe yönlendirir", async ({ page }) => {
    await page.goto("/kulup-kur");
    await expect(page.getByText(/önce üye ol/)).toBeVisible();
  });
});
