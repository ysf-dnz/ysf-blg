import { expect, test } from "@playwright/test";
import { neon } from "@neondatabase/serverless";

/**
 * Faz 5 (F5-04): işaretli (users.flagged_at) üye liderlik tablolarında görünmez.
 * Demo üyeyle sınanır; işaret `finally`'de geri alınır (dev = canlı DB). Ekonomi kartı ve suistimal
 * kuyruğu yalnız admin'e açık: SQL'leri entegrasyon testinde, kart bileşen testinde sınanır.
 */
test("işaretli üye liderlik tablolarında görünmez; işaret kalkınca geri gelir", async ({ request }) => {
  test.skip(!process.env.POSTGRES_URL, "POSTGRES_URL yok");
  const sql = neon(process.env.POSTGRES_URL!);
  const tablo = async (t: string) => (await request.get(`/lider?t=${t}`)).text();
  expect(await tablo("all"), "demo veri eskimiş olabilir: npm run seed:demo").toContain("/u/elif-celik");
  try {
    await sql`update users set flagged_at = now() where handle = 'elif-celik'`;
    for (const t of ["7", "30", "all"]) expect(await tablo(t), `?t=${t}`).not.toContain("/u/elif-celik");
  } finally {
    await sql`update users set flagged_at = null where handle = 'elif-celik'`;
  }
  expect(await tablo("all")).toContain("/u/elif-celik");
});
