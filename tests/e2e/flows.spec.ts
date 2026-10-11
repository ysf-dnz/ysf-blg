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
    const [p, h] = await Promise.all([popup.boundingBox(), page.locator("#harita").boundingBox()]);
    expect(p && h && p.y >= h.y && p.y + p.height <= h.y + h.height && p.x >= h.x && p.x + p.width <= h.x + h.width).toBe(true);
  });

  test("kulüp kurma sayfası misafiri üyeliğe yönlendirir", async ({ page }) => {
    await page.goto("/kulup-kur");
    await expect(page.getByText(/önce üye ol/)).toBeVisible();
  });
});
