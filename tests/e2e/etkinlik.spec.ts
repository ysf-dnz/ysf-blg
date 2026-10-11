import { expect, test } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

import { biletToken, donenPencere, donenToken } from "../../src/lib/etkinlik-kural.ts";

// seed:demo — yaklaşan etkinlik (kontenjan 40) ve Elif'in etkinlik daveti DEMEV01
const YAKLASAN = "/etkinlik/canli-quiz-gecesi-demo";
// seed:demo — devam eden etkinlik (14 gün); global-setup test üyesini burada giriş görevlisi yapar
const MARATON = "/etkinlik/go-okuma-maratonu-demo";

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

  test("F3-04: Biletlerim kişisel QR'ı gösterir; /T/ 301'i ve /t/q/ görevli olmayana yalnız 'bu bir bilettir' der", async ({ page }) => {
    await page.goto(YAKLASAN, { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: /Biletimi göster/ }).click();
    await expect(page).toHaveURL(/\/uye\/biletler#bilet-\d+/);
    const bilet = page.locator("[data-bilet]", { hasText: "Canlı Quiz Gecesi" });
    await expect(bilet.locator("svg")).toHaveCount(1); // QR sunucuda SVG
    const token = (await bilet.getAttribute("data-bilet"))!;
    expect(token).toMatch(/^\d+\.[0-9A-HJKMNP-TV-Z]{16}$/); // {rsvpId}.{base32 imza}

    // QR içeriği büyük harf /T/ yolu: 301 → /t/q/ (hedef kaynağın küçük harfli hâli DEĞİL)
    const r = await page.request.get(`/T/${token}`, { maxRedirects: 0 });
    expect(r.status()).toBe(301);
    expect(r.headers()["location"]).toBe(`/t/q/${token}`);
    // Bilet sahibi görevli değildir: giriş yazılmaz, yalnız bilgi sayfası
    await page.goto(`/t/q/${token}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Bu bir etkinlik biletidir" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Biletlerim" })).toBeVisible();
    // Bozuk imza bilet değildir
    const bozuk = token.slice(0, -1) + (token.endsWith("0") ? "1" : "0");
    expect((await page.request.get(`/t/q/${bozuk}`)).status()).toBe(404);
  });

  test("F3-04: görevli olmayan üye giriş ekranını göremez ve kendi biletini okutamaz", async ({ page }) => {
    expect((await page.request.get(`${YAKLASAN}/giris`)).status()).toBe(404);
    await page.goto("/uye/biletler", { waitUntil: "domcontentloaded" });
    const token = (await page.locator("[data-bilet]").first().getAttribute("data-bilet"))!;
    const r = await page.request.post("/api/uye/giris", { data: { token } });
    expect(r.status()).toBe(403);
    expect((await r.json()).durum).toBe("yetkisiz");
    await page.goto("/uye/biletler", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-bilet]", { hasText: "Canlı Quiz Gecesi" }).getByText(/Girişin doğrulandı/)).toHaveCount(0);
  });

  test("F3-04 (AC-16, AC-18): görevli tarayıcısı — tekrar okutma 'Zaten geldi (saat)'; çevrimdışı okutma kuyruğa girer, bağlantı gelince bir kez işlenir", async ({ page, context }) => {
    const r = await page.goto(`${MARATON}/giris`, { waitUntil: "domcontentloaded" });
    test.skip(r?.status() === 404, "test üyesi demo etkinlikte görevli değil ya da seed eski (npm run seed:demo, sonra yeniden koş)");
    test.skip(!process.env.CRON_SECRET, "CRON_SECRET yok — bilet imzası üretilemez");
    await expect(page.locator('[data-giris][data-init="1"]')).toBeAttached(); // tarayıcı betiği bağlandı
    await expect(page.getByText(/giriş açık/)).toBeVisible();
    const sonuc = page.locator("[data-sonuc-baslik]");
    const kuyruk = page.locator("[data-kuyruk]");
    const okut = async (token: string) => {
      await page.locator("[data-elle-girdi]").fill(token);
      await page.getByRole("button", { name: "Doğrula" }).click();
    };

    // AC-16: daha önce giriş yapmış katılımcının bileti (seed: Mehmet, Zeynep)
    const gelmis = Number(await page.locator('[data-rsvp][data-geldi="1"]').first().getAttribute("data-rsvp"));
    await okut(biletToken(gelmis));
    await expect(sonuc).toHaveText(/^Zaten geldi \(\d{2}:\d{2}\)$/);
    await expect(page.locator("[data-sonuc]")).toHaveClass(/border-amber-500/);

    // Bozuk imza
    await okut(`${gelmis}.AAAAAAAAAAAAAAAA`);
    await expect(sonuc).toHaveText("Geçersiz bilet");

    // AC-18: bağlantı yokken okutulan bilet kuyruğa girer (aynı bilet iki kez okutulsa da TEK kayıt)
    const hedef = page.locator('[data-rsvp][data-geldi="0"]').first();
    const rsvp = (await hedef.count()) ? Number(await hedef.getAttribute("data-rsvp")) : gelmis; // tekrar koşumda herkes gelmiş olabilir
    await context.setOffline(true);
    await okut(biletToken(rsvp));
    await expect(sonuc).toHaveText("Bağlantı yok");
    await expect(kuyruk).toHaveText(/bekleyen bilet: 1$/);
    await okut(biletToken(rsvp));
    await expect(kuyruk).toHaveText(/bekleyen bilet: 1$/);
    // Bağlantı gelince kuyruk kendiliğinden boşalır ve sonuç görünür
    await context.setOffline(false);
    await expect(kuyruk).toHaveText("", { timeout: 20_000 });
    await expect(sonuc).toHaveText(/^(✓ .+|Zaten geldi \(\d{2}:\d{2}\))$/);
    // Sayfa yenilenince de kuyruk boş (localStorage'dan düştü) ve katılımcı listede "geldi"
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-giris][data-init="1"]')).toBeAttached();
    await expect(kuyruk).toHaveText("");
    await expect(page.locator(`[data-rsvp="${rsvp}"]`)).toHaveAttribute("data-geldi", "1");
  });

  test("F3-05 (AC-17): dönen QR — 2 dk önceki ekran görüntüsü reddedilir; güncel QR girişi doğrular; ekran yalnız görevliye", async ({ page }) => {
    test.skip(!process.env.CRON_SECRET, "CRON_SECRET yok — dönen QR imzası üretilemez");
    await page.goto(MARATON, { waitUntil: "domcontentloaded" });
    const id = Number(await page.locator("[data-etkinlik-id]").getAttribute("data-etkinlik-id"));
    test.skip((await page.getByText("Sona erdi").count()) > 0, "demo maraton bitmiş — npm run seed:demo");

    // AC-17: 2 dakika önce üretilmiş token
    await page.goto(`/c/q/${id}/${donenToken(id, donenPencere(new Date(Date.now() - 120_000)))}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Bu QR'ın süresi doldu" })).toBeVisible();

    // QR içeriği büyük harf /C/ yolu: 301 → /c/q/ (aynı yola değil — canlıda döngü olurdu)
    const tok = donenToken(id, donenPencere());
    const r = await page.request.get(`/C/${id}/${tok}`, { maxRedirects: 0 });
    expect(r.status()).toBe(301);
    expect(r.headers()["location"]).toBe(`/c/q/${id}/${tok}`);

    // Güncel token: giriş yazılır (ilk koşum) ya da zaten yazılmıştır (tekrar koşum) → etkinlik sayfası
    await page.goto(`/c/q/${id}/${donenToken(id, donenPencere())}`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/go-okuma-maratonu-demo\?giris=(geldi|zaten)/);
    await expect(page.locator("[data-kayit-kutusu]").getByText(/Girişin doğrulandı ✓ \(\d{2}:\d{2}\)/)).toBeVisible();
    // Tekrar okutma: yeni giriş yok
    await page.goto(`/c/q/${id}/${donenToken(id, donenPencere())}`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/giris=zaten/);
    // Bilet de "doğrulandı" gösterir
    await page.goto("/uye/biletler", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-bilet]", { hasText: "Go Okuma Maratonu" }).getByText(/Girişin doğrulandı ✓/)).toBeVisible();

    // Ekran: test üyesi maratonda görevli (global-setup); QR görseli SVG ve önbelleksiz
    const ekran = await page.goto(`${MARATON}/ekran`, { waitUntil: "domcontentloaded" });
    if (ekran?.status() === 200) {
      await expect(page.locator("[data-ekran-qr]")).toBeVisible();
      const svg = await page.request.get(`/api/uye/etkinlik-qr?e=${id}`);
      expect(svg.status()).toBe(200);
      expect(svg.headers()["content-type"]).toContain("image/svg+xml");
      expect(svg.headers()["cache-control"]).toBe("no-store");
    }
    // Görevli olmadığı etkinlikte ekran ve QR ucu yok
    expect((await page.request.get(`${YAKLASAN}/ekran`)).status()).toBe(404);
    await page.goto(YAKLASAN, { waitUntil: "domcontentloaded" });
    const baskaId = await page.locator("[data-etkinlik-id]").getAttribute("data-etkinlik-id");
    expect((await page.request.get(`/api/uye/etkinlik-qr?e=${baskaId}`)).status()).toBe(404);
  });
});
