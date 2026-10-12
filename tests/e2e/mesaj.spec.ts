import { expect, test, type Page } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";
import { neon } from "@neondatabase/serverless";

// seed:demo üyeleri. Ön koşullar global-setup'ta: Elif test üyesine okunmamış mesaj yazmış,
// Zeynep test üyesini engellemiş. Can ile bağ yok (ayarı varsayılan), Mehmet "kimse", Mehmet ve Can
// haritada görünmeye rıza vermemiş.
const ELIF = "elif-celik";
const AYSE = "ayse-demir";
const ZEYNEP = "zeynep-arslan";
const CAN = "can-yildiz";
const MEHMET = "mehmet-kaya";

type Pin = { il: string; gorunen: number; uyeler: { h: string }[]; etkinlikler: unknown[] };
async function haritaVerisi(page: Page, yol = "/harita") {
  await page.route("**/tile.openstreetmap.org/**", (r) => r.abort()); // OSMF karo sunucusunu testte yorma
  await page.goto(yol, { waitUntil: "domcontentloaded" });
  const veri = JSON.parse((await page.locator("#harita-veri").textContent()) ?? "{}") as { pinler: Pin[]; bakan: string | null; filtreli: boolean };
  return { ...veri, handlelar: veri.pinler.flatMap((p) => p.uyeler.map((u) => u.h)).sort() };
}
// Ön koşulu TESTİN İÇİNDE kurmak için (global-setup'ın kurduğu durum, önce koşan başka bir spec'te
// tüketilebiliyor → test skip'e düşüp hiçbir şey sınamıyordu). Dev = canlı DB: yalnız test üyesi + demo üye.
const db = () => neon(process.env.POSTGRES_URL!);
const benimId = async () => Number((await db()`select id from users where clerk_id = ${process.env.E2E_CLERK_ID!}`)[0]!.id);

const gonder = (page: Page, kisi: string, json = false) =>
  page.request.post("/api/uye/mesaj", {
    form: { action: "send", kisi, body: "e2e ret denemesi" },
    maxRedirects: 0,
    headers: json ? { accept: "application/json" } : {},
  });

// Auth projesi (seri, tek worker). Dev = canlı DB: yalnız demo üyelerle yazışılır.
test.describe("mesaj, engel ve üye haritası — üye (Faz 4)", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!process.env.E2E_CLERK_USER, "CLERK_SECRET_KEY yok — auth e2e atlandı");
    await page.goto("/");
    await clerk.signIn({ page, emailAddress: process.env.E2E_CLERK_USER! });
    await page.goto("/uye", { waitUntil: "domcontentloaded" }); // üye satırı ilk SSR isteğinde açılır
    test.skip(!process.env.E2E_MESAJ, "ön koşul yok (ilk koşum ya da seed eski) — npm run seed:demo, sonra yeniden koş");
  });

  test("F4-03: gelen kutusu → GET okundu yazmaz, sayfa betiği POST'la yazar → mesaj gönderilir; AC-24 javascript: tıklanamaz", async ({ page }) => {
    await page.goto("/uye/mesajlar", { waitUntil: "domcontentloaded" });
    const satir = page.locator(`[data-konusma="${ELIF}"]`);
    await expect(satir).toBeVisible();
    const okunmamisVardi = (await satir.locator("[data-okunmamis]").count()) > 0; // yeniden denemede okunmuş olabilir

    // Betiksiz GET (ön-yükleme, görsel isteği) okundu YAZMAZ
    expect((await page.request.get(`/uye/mesajlar/${ELIF}`)).status()).toBe(200);
    await page.reload({ waitUntil: "domcontentloaded" });
    expect((await satir.locator("[data-okunmamis]").count()) > 0).toBe(okunmamisVardi);

    // Konuşma açılır: betik okundu POST'unu atar, zil rozeti sıfırlanır
    const okundu = page.waitForResponse((r) => r.url().endsWith("/api/uye/mesaj") && r.request().method() === "POST");
    await page.goto(`/uye/mesajlar/${ELIF}`);
    expect((await okundu).status()).toBe(200);
    await expect(page.locator('#mesajlar [data-benden="0"]').first()).toBeVisible();

    // Gönderim (sayfa yenilenmeden): düz metin; yalnız https bağlantı olur
    const damga = `e2e ${Date.now()}`;
    await page.locator("[data-mesaj-formu] textarea").fill(`${damga} bak javascript:alert(1) ve https://example.com/yol. <b>kalın</b>`);
    await page.getByRole("button", { name: "Gönder" }).click();
    const balon = page.locator("#mesajlar [data-mesaj]", { hasText: damga });
    const dogrula = async () => {
      await expect(balon).toHaveCount(1);
      await expect(balon.locator("[data-govde]")).toContainText("javascript:alert(1)");
      await expect(balon.locator("[data-govde]")).toContainText("<b>kalın</b>"); // HTML işlenmez
      await expect(balon.locator("a")).toHaveCount(1);
      await expect(balon.locator("a")).toHaveAttribute("href", "https://example.com/yol");
      await expect(balon.locator("b")).toHaveCount(0);
    };
    await dogrula(); // istemci render'ı (yoklama cevabı)
    await expect(page.locator("[data-mesaj-formu] textarea")).toHaveValue("");
    await page.reload({ waitUntil: "domcontentloaded" });
    await dogrula(); // sunucu render'ı
    await expect(page.locator('#mesajlar a[href^="javascript"]')).toHaveCount(0);

    // Yoklama (12 sn): konuşma açıkken gelen mesaj yenilemeden görünür, şikâyet düğmesiyle birlikte,
    // ve okundu yazılır
    const gelen = `e2e gelen ${Date.now()}`;
    await db()`insert into messages (sender_id, recipient_id, body) select e.id, ${await benimId()}, ${gelen} from users e where e.handle = ${ELIF}`;
    const gelenBalon = page.locator('#mesajlar [data-mesaj][data-benden="0"]', { hasText: gelen });
    await expect(gelenBalon).toHaveCount(1, { timeout: 25_000 });
    await expect(gelenBalon.locator("[data-mesaj-sikayet]")).toBeVisible();

    // Okundu yazıldı: gelen kutusunda rozet yok, en üstte bu konuşma
    await page.goto("/uye/mesajlar", { waitUntil: "domcontentloaded" });
    await expect(satir.locator("[data-okunmamis]")).toHaveCount(0);
    await expect(page.locator("[data-gelen-kutusu] [data-konusma]").first()).toHaveAttribute("data-konusma", ELIF);
    await expect(satir).toContainText(gelen);

    // Yoklama ucu: imleçten sonrası boş, önbelleksiz; başka üyenin konuşması okunamaz
    const son = await page.request.get(`/api/uye/mesaj?kisi=${ELIF}&since=999999999`);
    expect(son.headers()["cache-control"]).toContain("no-store");
    expect(await son.json()).toEqual({ mesajlar: [] });
    expect((await page.request.get("/api/uye/mesaj?kisi=olmayan-uye-xyz")).status()).toBe(404);
  });

  test("bildirimler: /uye GET'i okundu yazmaz (ön-yükleme sayacı sıfırlamasın); pano açılınca betik POST'lar", async ({ page }) => {
    const rozet = page.locator("[data-bildirim-rozet]");
    const zil = page.locator('header a[href="/uye#bildirimler"]');
    // Ön koşul burada: okunmamış bir bildirim (auth.spec gibi /uye'yi açan önceki testler okundu yazmış olabilir)
    await db()`insert into notifications (user_id, kind, body, href) values (${await benimId()}, 'system', 'e2e: pano açılınca okundu olur', '/uye')`;
    await page.goto("/uye/profil", { waitUntil: "domcontentloaded" });
    await expect(rozet).toBeVisible();
    // Betiksiz GET (zile hover ön-yüklemesi, görsel isteği): sayaç DEĞİŞMEZ
    expect((await page.request.get("/uye")).status()).toBe(200);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(rozet).toBeVisible();
    // Pano gerçekten açılınca betik okundu POST'unu atar
    const okundu = page.waitForResponse((r) => r.url().endsWith("/api/uye/bildirim") && r.request().method() === "POST");
    await page.goto("/uye");
    expect((await okundu).status()).toBe(204);
    await expect(page.locator("#bildirimler")).toContainText("yeni"); // bu görüntülemede hâlâ "N yeni" vurgulu
    await page.goto("/uye/profil", { waitUntil: "domcontentloaded" });
    await expect(zil).toBeVisible();
    await expect(rozet).toHaveCount(0);
    // son=0 / bozuk istek yazmaz
    expect((await page.request.post("/api/uye/bildirim", { form: { son: "abc" } })).status()).toBe(400);
  });

  test("AC-23: bağı olmayan üyeye yeni konuşma başlatılamaz; ayarı 'kimse' olana da — form yok, uç reddeder", async ({ page }) => {
    await page.goto(`/uye/mesajlar/${CAN}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-mesaj-kapali]")).toContainText("yalnız ortak topluluğu olan ya da karşılıklı takipleştiği üyelerden mesaj alıyor");
    await expect(page.locator("[data-mesaj-formu]")).toHaveCount(0);
    const can = await gonder(page, CAN);
    expect(can.status()).toBe(302);
    expect(can.headers()["location"]).toBe(`/uye/mesajlar/${CAN}?hata=bag`);
    const canJson = await gonder(page, CAN, true);
    expect(canJson.status()).toBe(403);
    expect((await canJson.json()).durum).toBe("bag");

    await page.goto(`/uye/mesajlar/${MEHMET}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-mesaj-kapali]")).toContainText("şu an yeni mesaj almıyor");
    expect((await gonder(page, MEHMET)).headers()["location"]).toBe(`/uye/mesajlar/${MEHMET}?hata=kapali`);
    // Hata bandı gerekçeyi söyler
    await page.goto(`/uye/mesajlar/${CAN}?hata=bag`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-mesaj-hata]")).toContainText("ortak topluluğu olan");
  });

  test("AC-22 + AC-21: engelleyene mesaj atılamaz, Mesaj düğmesi yok, haritada görünmez; rızasız üye haritada yok; filtre", async ({ page }) => {
    // Zeynep test üyesini engelledi (global-setup): form yok, uç reddeder — ama engel SÖYLENMEZ:
    // Mesaj düğmesi yerinde, metin / adres / durum kodu "kimse" ayarlı Mehmet'inkiyle birebir aynı
    await page.goto(`/u/${ZEYNEP}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-profil-islemler]")).toBeVisible();
    await expect(page.locator("[data-mesaj-gonder]")).toHaveCount(1);
    await page.goto(`/uye/mesajlar/${ZEYNEP}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-mesaj-kapali]")).toHaveText(/şu an yeni mesaj almıyor/);
    await expect(page.locator("[data-mesaj-kapali]")).not.toContainText(/engel/i);
    await expect(page.locator("[data-mesaj-formu]")).toHaveCount(0);
    expect((await gonder(page, ZEYNEP)).headers()["location"]).toBe(`/uye/mesajlar/${ZEYNEP}?hata=kapali`);
    const zeynepJson = await gonder(page, ZEYNEP, true);
    expect(zeynepJson.status()).toBe(403);
    expect(JSON.stringify(await zeynepJson.json())).not.toMatch(/engel/i);
    expect((await zeynepJson.json()).durum).toBe("kapali");
    // Engel varken takip de yazılmaz (takip et / bırak döngüsü bildirim kanalı olmasın)
    await page.locator('form[action="/api/uye/takip"] button').click();
    await expect(page).toHaveURL(new RegExp(`/u/${ZEYNEP}$`));
    await expect(page.locator('form[action="/api/uye/takip"] button')).toHaveText("Takip et");
    await page.goto(`/u/${ELIF}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-mesaj-gonder]")).toHaveAttribute("href", `/uye/mesajlar/${ELIF}`);

    // Harita verisi: rızalı Elif + Ayşe var; engelleyen Zeynep ve rızasız Mehmet/Can sayfa kaynağında YOK
    const h = await haritaVerisi(page);
    expect(h.bakan).toBeTruthy();
    expect(h.handlelar).toEqual(expect.arrayContaining([AYSE, ELIF]));
    for (const yok of [ZEYNEP, MEHMET, CAN]) expect(JSON.stringify(h.pinler)).not.toContain(yok);
    await expect(page.locator("[data-harita-filtre]")).toBeVisible();

    // İstanbul popup'ı: Elif (rızalı) var, aynı ildeki Mehmet (rızasız) yok; Profil + Mesaj bağlantıları
    await page.locator('.leaflet-marker-icon[title^="İstanbul:"]').click();
    const izgara = page.locator('.leaflet-popup [data-harita-uyeler="İstanbul"]');
    await expect(izgara.locator(`[data-uye="${ELIF}"]`)).toContainText(/Elif Çelik\s*Sv \d/);
    await expect(izgara.locator(`a[href="/u/${ELIF}"]`)).toBeVisible();
    await expect(izgara.locator(`a[href="/uye/mesajlar/${ELIF}"]`)).toHaveText("Mesaj");
    await expect(izgara.locator(`[data-uye="${MEHMET}"]`)).toHaveCount(0);

    // Filtre (sorgu parametresi): İzmir vakfının üyeleri Zeynep (engelli → yok) ve Elif
    const vakif = await haritaVerisi(page, "/harita?topluluk=izmir-okuma-vakfi-demo");
    // (Demo topluluklar canlıda herkese açık: gerçek bir üye katılıp rıza verirse tam eşitlik kırılırdı →
    // "içerir" + "engelleyen/rızasız yok" beklentileri)
    expect(vakif.filtreli).toBe(true);
    expect(vakif.handlelar).toContain(ELIF);
    expect(vakif.handlelar).not.toContain(ZEYNEP);
    expect(vakif.handlelar).not.toContain(AYSE); // vakıf üyesi değil: filtre gerçekten süzüyor
    expect(await page.locator(".harita-rozet-filtre").count()).toBeGreaterThanOrEqual(1);
    await expect(page.locator("[data-harita-gorunen]")).toContainText(/Filtreye uyan \d+ üye/);
    // ODTÜ kulübü: Ayşe, Elif, Mehmet, Can üye — yalnız rızalı ikisi
    const odtu = (await haritaVerisi(page, "/harita?topluluk=odtu-yz-okuma-demo")).handlelar;
    expect(odtu).toEqual(expect.arrayContaining([AYSE, ELIF]));
    for (const yok of [MEHMET, CAN, ZEYNEP]) expect(odtu).not.toContain(yok);
  });

  test("F4-04: engelle → Mesaj düğmesi ve form kaybolur → engeli kaldır; üye ve mesaj şikâyeti alınır", async ({ page }) => {
    try {
      await page.goto(`/u/${AYSE}`, { waitUntil: "domcontentloaded" });
      const dugme = page.locator("[data-profil-islemler] [data-engel-dugmesi]");
      if ((await dugme.textContent())?.trim() === "Engelle") await dugme.click(); // yarıda kalmış koşumda zaten engelli
      await expect(dugme).toHaveText("Engeli kaldır");
      await expect(page.locator("[data-mesaj-gonder]")).toHaveCount(0);
      await page.goto(`/uye/mesajlar/${AYSE}`, { waitUntil: "domcontentloaded" });
      await expect(page.locator("[data-mesaj-kapali]")).toContainText("Bu üyeyi engelledin");
      await expect(page.locator("[data-mesaj-formu]")).toHaveCount(0);
      expect((await gonder(page, AYSE)).headers()["location"]).toBe(`/uye/mesajlar/${AYSE}?hata=engel`);
      expect((await haritaVerisi(page)).handlelar).not.toContain(AYSE); // engellediğim üye haritamda da yok
      // Engeli konuşma sayfasından kaldır
      await page.goto(`/uye/mesajlar/${AYSE}`, { waitUntil: "domcontentloaded" });
      await page.locator("[data-engel-dugmesi]").click();
      await expect(page.locator("[data-engel-dugmesi]")).toHaveText("Engelle");
    } finally {
      // Engel kalıcı kalmasın (dev = canlı DB; sonraki koşumlar ve harita beklentisi)
      await page.request.post("/api/uye/mesaj", { form: { action: "engel-kaldir", kisi: AYSE }, maxRedirects: 0 });
    }
    expect((await haritaVerisi(page)).handlelar).toContain(AYSE);

    // Üye şikâyeti (profil) — saatte 10 freni art arda koşumlarda "hiz" döndürebilir; ikisi de bantla söylenir
    await page.goto(`/u/${CAN}`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-sikayet-ac]").click();
    await page.locator('[data-profil-islemler] input[name="reason"]').fill("e2e deneme şikâyeti");
    await page.getByRole("button", { name: "Şikâyeti gönder" }).click();
    await expect(page).toHaveURL(new RegExp(`/u/${CAN}\\?sikayet=(1|var|hiz)`));
    await expect(page.locator("[data-sikayet-bandi]")).toBeVisible();
    // Mesaj şikâyeti (konuşma): yalnız GELEN mesajda düğme var
    await page.goto(`/uye/mesajlar/${ELIF}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator('#mesajlar [data-benden="1"] [data-mesaj-sikayet]')).toHaveCount(0);
    // Yanlış dokunuşa karşı onay: reddedilirse gönderilmez, kabul edilirse gönderilir
    page.once("dialog", (d) => d.dismiss());
    await page.locator('#mesajlar [data-benden="0"] [data-mesaj-sikayet]').first().click();
    await expect(page).toHaveURL(new RegExp(`/uye/mesajlar/${ELIF}$`));
    page.once("dialog", (d) => d.accept());
    await page.locator('#mesajlar [data-benden="0"] [data-mesaj-sikayet]').first().click();
    await expect(page).toHaveURL(new RegExp(`/uye/mesajlar/${ELIF}\\?sikayet=(1|var|hiz)`));
    await expect(page.locator("[data-sikayet-bandi]")).toBeVisible();
    // Kendini ve başkasının mesajını şikâyet edemez (id deneyerek yazışma kuyruğa düşürülemez)
    // Mesajı yalnız ALICISI şikâyet eder: var olan ama benim GÖNDERDİĞİM mesaj → 404 (id deneyerek başkasının
    // yazışması admin kuyruğuna düşürülemez); kendini şikâyet → 404; olmayan id → 404
    const benimMesajim = await page.locator('#mesajlar [data-benden="1"]').last().getAttribute("data-mesaj");
    expect(benimMesajim).toMatch(/^\d+$/);
    const sikayet = (form: Record<string, string>) => page.request.post("/api/uye/sikayet", { form, maxRedirects: 0 });
    expect((await sikayet({ targetType: "message", targetId: benimMesajim! })).status()).toBe(404);
    expect((await sikayet({ targetType: "user", targetId: String(await benimId()) })).status()).toBe(404);
    const kendi = await sikayet({ targetType: "message", targetId: "999999999" });
    expect(kendi.status()).toBe(404);
    // Şikâyet gerçekten kuyruğa düştü (açık kayıt): Can (üye) + Elif'in mesajı
    const acik = await db()`select target_type from reports where reporter_id = ${await benimId()} and status = 'open' and target_type in ('user', 'message')`;
    expect(acik.map((r) => r.target_type).sort()).toEqual(expect.arrayContaining(["message", "user"]));
    // int4'ü aşan id Postgres hatası (500) değil, doğrulama hatası
    expect((await page.request.post("/api/uye/sikayet", { form: { targetType: "user", targetId: "99999999999" }, maxRedirects: 0 })).status()).toBe(400);
    expect(await (await page.request.get(`/api/uye/mesaj?kisi=${ELIF}&since=99999999999`)).json()).toHaveProperty("mesajlar");
  });

  test("F4-02: profilde açık rıza → haritada kendini görür; rızayı kaldırınca çıkar (varsayılan kapalı)", async ({ page }) => {
    const kaydet = async (gorun: boolean) => {
      await page.goto("/uye/profil", { waitUntil: "domcontentloaded" });
      await page.locator('select[name="city"]').selectOption(gorun ? "Ardahan" : "");
      await page.locator('input[name="mapVisible"]').setChecked(gorun);
      await page.getByRole("button", { name: "Kaydet" }).click();
      await expect(page).toHaveURL(/durum=ok/);
    };
    try {
      await kaydet(true);
      await expect(page.locator('input[name="mapVisible"]')).toBeChecked();
      await expect(page.getByText("üyelere görünüyorsun")).toBeVisible();
      const acik = await haritaVerisi(page);
      expect(acik.pinler.find((p) => p.il === "Ardahan")?.uyeler.map((u) => u.h)).toContain(acik.bakan);
      await expect(page.locator("[data-harita-gorunen]")).not.toContainText("Sen görünmüyorsun");
    } finally {
      await kaydet(false); // test üyesi canlı haritada kalmasın
    }
    await expect(page.locator('input[name="mapVisible"]')).not.toBeChecked();
    const kapali = await haritaVerisi(page);
    expect(kapali.handlelar).not.toContain(kapali.bakan);
    await expect(page.locator("[data-harita-gorunen]")).toContainText("Sen görünmüyorsun");
    // Şehir yokken rıza kutusu tek başına görünür yapmaz
    await page.goto("/uye/profil", { waitUntil: "domcontentloaded" });
    await page.locator('input[name="mapVisible"]').check();
    await page.getByRole("button", { name: "Kaydet" }).click();
    await expect(page).toHaveURL(/durum=ok/);
    await expect(page.locator('input[name="mapVisible"]')).not.toBeChecked();
  });
});
