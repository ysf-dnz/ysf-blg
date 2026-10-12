import { expect, test } from "@playwright/test";
import { neon } from "@neondatabase/serverless";

// İki test de demo Elif'in işaretini yazıp geri alır; misafir projesi paralel → aynı dosyada sırayla (bağımsız: default)
test.describe.configure({ mode: "default" });

/**
 * Faz 5 (F5-04): işaretli (users.flagged_at) üye liderlik tablolarında görünmez.
 * Demo üyeyle sınanır; işaret `finally`'de geri alınır (dev = canlı DB). Ekonomi kartı ve suistimal
 * kuyruğu yalnız admin'e açık: SQL'leri entegrasyon testinde, kart bileşen testinde sınanır.
 */
test("işaretli üye liderlik tablolarında görünmez; işaret kalkınca geri gelir", async ({ request }) => {
  test.skip(!process.env.POSTGRES_URL, "POSTGRES_URL yok");
  const sql = neon(process.env.POSTGRES_URL!);
  const tablo = async (t: string) => (await request.get(`/lider?t=${t}`)).text();
  // Yarıda kalmış bir koşumdan işaret kalmışsa önce temizle (global-teardown da temizler)
  await sql`update users set flagged_at = null where handle = 'elif-celik'`;
  // Yalnız işaretlemeden ÖNCE göründüğü sekmeler sınanır (görünmediği sekmede beklenti hep geçerdi)
  const sekmeler: string[] = [];
  for (const t of ["7", "30", "all"]) if ((await tablo(t)).includes("/u/elif-celik")) sekmeler.push(t);
  expect(sekmeler, "demo veri eskimiş olabilir: npm run seed:demo").toContain("all");
  try {
    await sql`update users set flagged_at = now() where handle = 'elif-celik'`;
    for (const t of sekmeler) expect(await tablo(t), `?t=${t}`).not.toContain("/u/elif-celik");
  } finally {
    await sql`update users set flagged_at = null where handle = 'elif-celik'`;
  }
  expect(await tablo("all")).toContain("/u/elif-celik");
});

/**
 * F5-04 sayfa sorguları (devir §4.5): işaretli üye /uyeler dizininde kalır ama sıranın sonuna düşer;
 * üniversite takım tablosuna ve akışın "Bu hafta" mini liderliğine sayılmaz. Demo üye Elif birkaç saniye işaretlenir.
 */
test("işaretli üye /uyeler'de sona düşer; üniversite tablosunda ve akışın 'Bu hafta' listesinde sayılmaz", async ({ request }) => {
  test.skip(!process.env.POSTGRES_URL, "POSTGRES_URL yok");
  const sql = neon(process.env.POSTGRES_URL!);
  const isaret = (deger: "now()" | "null") =>
    deger === "now()"
      ? sql`update users set flagged_at = now() where handle = 'elif-celik' and clerk_id like 'demo%'`
      : sql`update users set flagged_at = null where handle = 'elif-celik' and clerk_id like 'demo%'`;
  const html = async (yol: string) => (await request.get(yol)).text();
  const handles = (h: string) => [...new Set([...h.matchAll(/href="\/u\/([a-z0-9-]+)"/g)].map((m) => m[1]!))];
  const uniSatir = (h: string) => h.match(/Boğaziçi<\/span>\s*<span[^>]*>(\d+) p · (\d+) üye/)?.slice(1).map(Number);
  const buHafta = (h: string) => {
    const i = h.indexOf("Bu hafta");
    return i < 0 ? "" : h.slice(i, h.indexOf("</ol>", i));
  };
  const oku = async () => ({ uyeler: handles(await html("/uyeler")), uni: uniSatir(await html("/lider?t=all")), akis: buHafta(await html("/topluluk")) });
  await isaret("null");
  const once = await oku();
  expect(once.uyeler, "demo veri eskimiş olabilir: npm run seed:demo").toContain("elif-celik");
  expect(once.uyeler.indexOf("elif-celik")).toBeLessThan(once.uyeler.length - 1); // işaretsizken sonuncu değil
  try {
    await isaret("now()");
    const sonra = await oku();
    expect(sonra.uyeler).toContain("elif-celik"); // dizinde kalır
    expect(sonra.uyeler.at(-1)).toBe("elif-celik"); // sıranın sonuna düşer
    if (once.uni) expect(sonra.uni === undefined || sonra.uni[1]! < once.uni[1]!, "Boğaziçi satırı Elif'siz").toBe(true);
    if (once.akis.includes("/u/elif-celik")) expect(sonra.akis).not.toContain("/u/elif-celik");
  } finally {
    await isaret("null");
  }
});
