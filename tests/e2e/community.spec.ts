import { expect, test } from "@playwright/test";

test.describe("topluluk alanı — sekme çubuğu ve akış", () => {
  test("sekme çubuğu tüm bölümlere götürür, aktif sekme işaretli", async ({
    page,
  }) => {
    await page.goto("/topluluk");
    const nav = page.getByRole("navigation", { name: "Topluluk bölümleri" });
    await expect(nav).toBeVisible();

    // Akış aktif
    await expect(nav.getByRole("link", { name: /Akış/ })).toHaveAttribute(
      "aria-current",
      "page",
    );

    // Liderlik'e geç → aktiflik taşınır
    await nav.getByRole("link", { name: /Liderlik/ }).click();
    await expect(page).toHaveURL(/\/lider/);
    await expect(
      page
        .getByRole("navigation", { name: "Topluluk bölümleri" })
        .getByRole("link", { name: /Liderlik/ }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("misafir akışta üye-ol daveti görür, composer görmez", async ({ page }) => {
    await page.goto("/topluluk");
    await expect(page.getByText("ilk kitabın hediye")).toBeVisible();
    await expect(page.locator('form[action="/api/uye/feed"]')).toHaveCount(0);
  });

  test("375px'te yatay taşma yok", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/topluluk");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > 375 + 1,
    );
    expect(overflow).toBe(false);
  });

  // Seviye TOPLAM kazanılandan (levels.ts): liderlik eskiden dönem toplamından hesaplıyordu — 144 kazanılan (Sv 4)
  // üye, son 7 günün 64 puanıyla "Sv 3" görünüyordu (profil ve pano Sv 4). Aynı üye her sekmede aynı seviyede olmalı.
  test("liderlikte seviye dönemden bağımsız: aynı üyenin Sv'si 7 gün / 30 gün / tüm zamanlar sekmelerinde aynı", async ({ request }) => {
    const seviyeler = async (t: string) => {
      const html = await (await request.get(`/lider?t=${t}`)).text();
      return new Map([...html.matchAll(/@([a-z0-9-]+) · Sv (\d)/g)].map((m) => [m[1]!, m[2]!]));
    };
    const tum = await seviyeler("all");
    expect(tum.size, "tüm zamanlar tablosu boş — npm run seed:demo").toBeGreaterThan(0);
    for (const t of ["7", "30"])
      for (const [handle, sv] of await seviyeler(t)) if (tum.has(handle)) expect(sv, `${handle} ?t=${t}`).toBe(tum.get(handle));
  });

  // Başlık yüksekliği --header-h ile ölçülür (motion/init.ts): sabit top-[65px] misafirde bile 11 px altına giriyordu
  test("yapışkan sekme çubuğu kaydırınca başlığın hemen altında durur (375 + 1280 px)", async ({ page }) => {
    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto("/topluluk", { waitUntil: "load" });
      await page.evaluate(() => {
        // Kısa akışta da çubuk yapışsın: ebeveyni uzatılır (yapışkan öğe ebeveyninin sınırında kalır)
        const cubuk = document.querySelector('nav[aria-label="Topluluk bölümleri"]')!;
        cubuk.parentElement!.append(Object.assign(document.createElement("div"), { style: "height:3000px" }));
        window.scrollTo({ top: 1500, behavior: "instant" }); // smooth kaydırmanın ara karesinde (scrollY ≈ 32) eski 65 px de 0 verirdi
      });
      const fark = () =>
        page.evaluate(() => {
          const baslik = document.querySelector(".site-header")!.getBoundingClientRect().bottom;
          return Math.round(document.querySelector('nav[aria-label="Topluluk bölümleri"]')!.getBoundingClientRect().top - baslik);
        });
      await expect.poll(fark, { message: `${width} px: çubuk üstü − başlık altı` }).toBe(0);
    }
  });
});
