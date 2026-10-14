import { expect, test, type Page } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

// Test üyesi tests/e2e/global-setup.ts'te açılır; CLERK_SECRET_KEY yoksa E2E_CLERK_USER boş kalır.
test("test üyesi giriş yapıp panoya ulaşır", async ({ page }) => {
  test.skip(!process.env.E2E_CLERK_USER, "CLERK_SECRET_KEY yok (.env.local) — auth e2e atlandı");
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: process.env.E2E_CLERK_USER! });
  await page.goto("/uye");
  await expect(page).toHaveURL(/\/uye$/);
});

// F5-04 (devir §4.4 / §4.5): admin ekranı admin olmayana kapalı; panoda tutulan satır "inceleniyor"
test("admin olmayan üye /uye/admin'e girince /uye'ye yönlendirilir; suistimal kuyruğu görmez", async ({ page }) => {
  test.skip(!process.env.E2E_CLERK_USER, "CLERK_SECRET_KEY yok (.env.local) — auth e2e atlandı");
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: process.env.E2E_CLERK_USER! });
  await page.goto("/uye/admin");
  await expect(page).toHaveURL(/\/uye$/);
  await expect(page.locator("[data-suistimal-kuyrugu]")).toHaveCount(0);
});

test("panoda işaretli kaynaktan doğan olgun bekleyen 'sırada' görünür ve kesinleşmez (işaretin kimde olduğu yazılmaz)", async ({ page }) => {
  test.skip(!process.env.E2E_CLERK_USER || !process.env.POSTGRES_URL || !process.env.E2E_CLERK_ID, "auth e2e için Clerk + DB gerekir");
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.POSTGRES_URL!);
  const [ben] = await sql`select id from users where clerk_id = ${process.env.E2E_CLERK_ID!}`;
  const t = Date.now().toString(36);
  const [kaynak] = await sql`insert into users (clerk_id, handle, name, flagged_at) values (${`demo_itest_e2e_${t}`}, ${`itest-e2e-${t}`}, 'Itest E2E Kaynak', now()) returning id`;
  const refId = `course:itest-e2e-${t}:u:${kaynak!.id}`;
  try {
    await sql`insert into pending_points (user_id, reason, ref_id, delta, note, matures_at)
      values (${ben!.id}, 'course_learner_activated', ${refId}, 5, 'Itest E2E kaynağı kursta aktive oldu', now() - interval '1 hour')`;
    await page.goto("/");
    await clerk.signIn({ page, emailAddress: process.env.E2E_CLERK_USER! });
    await page.goto("/uye");
    const satir = page.locator('[aria-label="Bekleyen puan"] li', { hasText: "Itest E2E kaynağı" });
    await expect(satir).toContainText("sırada");
    await expect(satir).not.toContainText(/işaret|suistimal/i);
    const [row] = await sql`select status from pending_points where user_id = ${ben!.id} and ref_id = ${refId}`;
    expect(row!.status).toBe("pending"); // pano GET'i kesinleştirmedi (tutulan)
  } finally {
    await sql`delete from pending_points where user_id = ${ben!.id} and ref_id = ${refId}`;
    await sql`delete from users where id = ${kaynak!.id}`;
  }
});

// B1 + B2 (2026-10-14, Yusuf'un iPhone görüntüleri): "Haritada görün" kutusu tutuk görünüyordu — kayıt ayrı düğmeydi
// ve düğme yüzen çubuğun altında kalıyordu; panodaki görev rızayı hiç sormuyor, puanı haritaya bağlıyordu.
test("harita rızası: panoda ayrı görev → #gizlilik; kutu dokununca kaydedilir, bant sonucu söyler; kaydedilmemiş profil alanı varken kendiliğinden gönderilmez", async ({ page }) => {
  test.skip(!process.env.E2E_CLERK_USER, "CLERK_SECRET_KEY yok (.env.local) — auth e2e atlandı");
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: process.env.E2E_CLERK_USER! });
  // Girişten sonraki ilk SSR'de Clerk el sıkışması sayfayı yeniden yükleyebiliyor (tıklama kaybolur) → mesaj.spec gibi önce /uye
  await page.goto("/uye", { waitUntil: "domcontentloaded" });
  // Ön koşul testin içinde: şehir kayıtlı (kutu ancak o zaman açılır), rıza kapalı
  await page.goto("/uye/profil", { waitUntil: "domcontentloaded" });
  await page.locator('select[name="city"]').selectOption("Ardahan");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(page).toHaveURL(/durum=ok/);
  const kutu = page.locator('input[name="mapVisible"]');
  const bant = page.locator("[data-gizlilik-bandi]");
  const gorev = page.locator('a[href="/uye/profil#gizlilik"]');
  try {
    if (await kutu.isChecked()) {
      await kutu.uncheck();
      await expect(bant).toContainText("görünmüyorsun");
    }
    await page.goto("/uye", { waitUntil: "domcontentloaded" });
    await expect(gorev).toContainText("Haritada görün");
    await expect(gorev).toContainText("puan vermez");
    await gorev.click();
    await expect(page).toHaveURL(/\/uye\/profil#gizlilik$/);
    // Profil formunda kaydedilmemiş yazı varken dokunuş göndermez (sayfa yenilenip yazılan kaybolmasın)
    await page.locator('textarea[name="bio"]').fill("e2e kaydedilmemiş bio");
    const gonderildi = page
      .waitForRequest((r) => r.url().endsWith("/api/uye/profil") && r.method() === "POST", { timeout: 2_000 })
      .then(() => true, () => false);
    await kutu.check();
    expect(await gonderildi).toBe(false);
    // Temiz sayfada dokunuş yeter — "Ayarları kaydet"e basılmaz
    await page.goto("/uye/profil", { waitUntil: "domcontentloaded" });
    await expect(kutu).not.toBeChecked(); // önceki dokunuş kaydedilmemişti
    await kutu.check();
    await expect(page).toHaveURL(/durum=gizlilik/);
    await expect(kutu).toBeChecked();
    await expect(bant).toContainText("üyelere görünüyorsun");
    await page.goto("/uye", { waitUntil: "domcontentloaded" });
    await expect(gorev).toHaveCount(0); // görev tamamlandı
    await page.goto("/uye/profil", { waitUntil: "domcontentloaded" });
    await kutu.uncheck();
    await expect(bant).toContainText("görünmüyorsun");
    await expect(kutu).not.toBeChecked();
  } finally {
    // test üyesi canlı haritada kalmasın: şehir boşalınca rıza da kalkar
    await page.request.post("/api/uye/profil", { form: { city: "", university: "", bio: "" }, maxRedirects: 0 });
  }
});

const tasanlar = (page: Page) =>
  page.evaluate(() => {
    const W = document.documentElement.clientWidth;
    const sw = document.documentElement.scrollWidth;
    if (sw <= W + 1) return [];
    const ad = (e: Element) => `<${e.tagName.toLowerCase()} class="${e.getAttribute("class") ?? ""}"> ${(e.textContent ?? "").trim().slice(0, 40)}`;
    return [`scrollWidth ${sw} > ${W}`, ...[...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > W + 1).slice(0, 5).map(ad)];
  });

// Yapışkan alt çubuk girişli başlığın hemen altında: dar ekranda logo iki satır (375 px'te 88 px) — sabit
// top-[65px] 23 px altına giriyordu. Başlık --header-h ile ölçülür; Clerk düğmesi sonradan gelince de güncellenir.
test("girişli dar ekranda yapışkan yazı çubuğu başlığın altına girmez", async ({ page }) => {
  test.skip(!process.env.E2E_CLERK_USER, "CLERK_SECRET_KEY yok (.env.local) — auth e2e atlandı");
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: process.env.E2E_CLERK_USER! });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/uye/yaz", { waitUntil: "load" });
  await page.locator(".cl-userButtonTrigger").waitFor(); // başlığın son hâli
  await page.evaluate(() => {
    // Yapışkan öğe ebeveyninin (#editor-form) sınırında kalır: ebeveyn uzatılır, sayfa kaydırılır
    document.querySelector("main#icerik .sticky")!.parentElement!.append(Object.assign(document.createElement("div"), { style: "height:3000px" }));
    window.scrollTo({ top: 1500, behavior: "instant" }); // smooth kaydırmanın ara karesinde (scrollY ≈ 32) eski 65 px de 0 verirdi
  });
  const fark = () =>
    page.evaluate(() => {
      const baslik = document.querySelector(".site-header")!.getBoundingClientRect().bottom;
      return Math.round(document.querySelector("main#icerik .sticky")!.getBoundingClientRect().top - baslik);
    });
  await expect.poll(fark, { message: "çubuk üstü − başlık altı" }).toBe(0);
});

// B4 + B5 (üye): 320 px'te taşma yok (girişli başlık 369 px istiyordu, profil formu 506, yazı çubuğu 413); yüzen çubuk
// görünürken main'in sonu kaydırılınca profil formunun son düğmesi çubuğun altında kalmaz
test("üye sayfaları 320 px'te yatay taşmaz; yüzen çubuk profil formunun son düğmesini örtmez", async ({ page }) => {
  test.skip(!process.env.E2E_CLERK_USER, "CLERK_SECRET_KEY yok (.env.local) — auth e2e atlandı");
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: process.env.E2E_CLERK_USER! });
  await page.setViewportSize({ width: 320, height: 700 });
  for (const yol of ["/uye", "/uye/profil", "/uye/magaza", "/uye/yaz"]) {
    await page.goto(yol, { waitUntil: "load" });
    await page.locator(".cl-userButtonTrigger").waitFor(); // başlığın en geniş hâli: Clerk düğmesi istemcide gelir
    expect(await tasanlar(page), yol).toEqual([]);
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/uye/profil", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#nudge-ogren")).toBeVisible({ timeout: 10_000 }); // 4 sn sonra belirir
  // Ayırt edici bekçi: main'in alt boşluğu çubuğun örttüğü şeritten az değil (kural sökülünce 32 px < ~60 px).
  // Aşağıdaki kesişim tek başına yetmiyor: bu sayfada iki satırlık ipucu düğmeyi zaten yukarı itiyor.
  const { bosluk, serit } = await page.evaluate(() => ({
    bosluk: parseFloat(getComputedStyle(document.querySelector("main#icerik")!).paddingBottom),
    serit: innerHeight - Math.min(...["#nudge-uret", "#nudge-ogren"].map((s) => document.querySelector(s)!.getBoundingClientRect().top)),
  }));
  expect(bosluk).toBeGreaterThanOrEqual(serit);
  await page.locator("main#icerik").evaluate((m) => m.scrollIntoView({ block: "end", behavior: "instant" }));
  const kutu = async (s: string) => (await page.locator(s).boundingBox())!;
  const dugme = await kutu('button:has-text("Ayarları kaydet")');
  for (const n of ["#nudge-uret", "#nudge-ogren"]) {
    const b = await kutu(n);
    const kesisir = dugme.x < b.x + b.width && b.x < dugme.x + dugme.width && dugme.y < b.y + b.height && b.y < dugme.y + dugme.height;
    expect(kesisir, n).toBe(false);
  }
});
