import { expect, test } from "@playwright/test";

// seed:demo — ODTÜ (üniversite, Ankara, 1 yayınlı kurs) + İzmir Okuma Vakfı (vakıf, İzmir)
const ODTU = "ODTÜ Yapay Zekâ Okuma Kulübü";
const VAKIF = "İzmir Okuma Vakfı";

test.describe("Topluluklarımız (F3-01)", () => {
  test("sekme adı 'Topluluklarımız', kart ızgarası tür · il · üye · kurs gösterir", async ({ page }) => {
    await page.goto("/kulupler", { waitUntil: "domcontentloaded" });
    const nav = page.getByRole("navigation", { name: "Topluluk bölümleri" });
    await expect(nav.getByRole("link", { name: /Topluluklarımız/ })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { level: 1, name: /Topluluklarımız/ })).toBeVisible();
    const odtu = page.locator("[data-topluluklar] li", { hasText: ODTU });
    await expect(odtu).toContainText("Üniversite");
    await expect(odtu).toContainText("Ankara");
    await expect(odtu).toContainText(/👥 \d+ üye · 🎓 1 kurs/);
    await expect(page.locator("[data-topluluklar] li", { hasText: VAKIF })).toContainText("Vakıf");
  });

  test("tür ve il filtreleri listeyi daraltır; geçersiz parametre yok sayılır", async ({ page }) => {
    await page.goto("/kulupler?tur=vakif", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(VAKIF)).toBeVisible();
    await expect(page.getByText(ODTU)).toHaveCount(0);

    await page.goto("/kulupler?il=Ankara", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(ODTU)).toBeVisible();
    await expect(page.getByText(VAKIF)).toHaveCount(0);

    await page.goto("/kulupler?tur=vakif&il=Ankara", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Bu filtrede topluluk yok.")).toBeVisible();

    await page.goto("/kulupler?tur=<script>&il=Atlantis", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(ODTU)).toBeVisible();
    await expect(page.getByText(VAKIF)).toBeVisible();
  });

  test("topluluk sayfası: Kurslar sekmesi yayındaki kursları listeler; bilinmeyen sekme panoya düşer", async ({ page }) => {
    await page.goto("/kulup/odtu-yz-okuma-demo?t=kurslar", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("link", { name: /🎓 Kurslar/ })).toHaveAttribute("aria-current", "page");
    const kurs = page.locator("[data-kulup-kurslar]").getByRole("link", { name: /Sıfırdan Go/ });
    await expect(kurs).toHaveAttribute("href", "/kurslar/sifirdan-go-learning-go-yol-haritasi-demo");

    await page.goto("/kulup/odtu-yz-okuma-demo?t=yok-boyle-sekme", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("link", { name: /📋 Pano/ })).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("Golang Ayı")).toBeVisible();
  });
});
