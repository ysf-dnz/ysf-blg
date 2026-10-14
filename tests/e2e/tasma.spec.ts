import { expect, test, type Page } from "@playwright/test";

// Yatay taşma bekçisi (2026-10-14, Yusuf'un iPhone görüntüleri): belge görünümden genişse iOS sayfayı uzaklaştırıp
// "orantısız genişlik" gösterir (/kutuphane 320–375 px'te 577 px'e açılıyordu). Taşan, kırpılmamış öğeler mesajda;
// düzeltme o öğede (grid-cols-1, min-w-0, flex-wrap, break-words) — body'ye overflow-x: hidden DEĞİL.
const KITAP = "1E9H87IkhEepEAO0KddTg2NzO_JoUZUJ2"; // pdf: kilit kartında önizleme paneli var
const SAYFALAR = ["/", "/kutuphane", `/kutuphane/kitap/${KITAP}`, "/topluluk", "/kurslar", "/etkinlikler", "/kulupler", "/harita", "/lider", "/uyeler", "/gundem", "/u/elif-celik"];

const tasanlar = (page: Page) =>
  page.evaluate(() => {
    const W = document.documentElement.clientWidth;
    const sw = document.documentElement.scrollWidth;
    if (sw <= W + 1) return [];
    const kirpik = (el: Element) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (getComputedStyle(p).overflowX !== "visible") return true;
      return false;
    };
    const ad = (e: Element) => `<${e.tagName.toLowerCase()} class="${e.getAttribute("class") ?? ""}"> ${(e.textContent ?? "").trim().slice(0, 40)}`;
    const tasan = [...document.querySelectorAll("body *")].filter(
      (e) => e.getBoundingClientRect().right > W + 1 && getComputedStyle(e).position !== "fixed" && !kirpik(e),
    );
    return [`scrollWidth ${sw} > ${W}`, ...tasan.slice(0, 5).map(ad)];
  });

test.describe("320 px'te yatay taşma yok (misafir)", () => {
  test.use({ viewport: { width: 320, height: 700 } });
  for (const yol of SAYFALAR)
    test(yol, async ({ page }) => {
      await page.route("**/tile.openstreetmap.org/**", (r) => r.abort()); // OSMF karo sunucusunu testte yorma
      await page.route("**/api/kitap-onizleme**", (r) => r.abort()); // panelin yerleşimi yeter, Drive'dan PDF çekme
      await page.goto(yol, { waitUntil: "load" });
      if (yol.startsWith("/kutuphane/kitap/")) {
        const onizleme = page.locator("details[data-onizleme]"); // OkumaKapisi server island'ı
        await onizleme.waitFor();
        await onizleme.evaluate((d) => ((d as HTMLDetailsElement).open = true));
      }
      expect(await tasanlar(page)).toEqual([]);
    });
});

// B5: yüzen Öğren/Üret çubuğu (fixed bottom-4) görünürken main'e alt boşluk verilir; kapatılınca kalkar
test("yüzen çubuk görünürken içeriğin sonunda boşluk var, kapatınca kalkar (375 px)", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const altBosluk = () => page.locator("main#icerik").evaluate((m) => parseFloat(getComputedStyle(m).paddingBottom));
  await expect(page.locator("#nudge-uret")).toBeVisible({ timeout: 10_000 }); // 4 sn sonra belirir
  expect(await altBosluk()).toBeGreaterThanOrEqual(80);
  // dispatchEvent: dev araç çubuğu (<astro-dev-toolbar>) 375 px'te kapat düğmesinin tıklamasını yutuyor
  await page.locator("#nudge-uret [data-nudge-kapat]").dispatchEvent("click");
  await page.locator("#nudge-ogren [data-nudge-kapat]").dispatchEvent("click");
  await expect.poll(altBosluk).toBeLessThan(80);
});
