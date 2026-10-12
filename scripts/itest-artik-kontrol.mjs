/**
 * Entegrasyon koşumundan sonra canlı DB'de test artığı kalmadığını SELECT ile doğrular — YAZMAZ.
 *   node --env-file=.env.local scripts/itest-artik-kontrol.mjs
 * Çıkış kodu 1: itest artığı (üye / kurs / kulüp / etkinlik / sezon / ziyaret), işaretli itest hesabı ya da
 * sahipsiz `suistimal-temiz` kaydı var. Gerçek işaretler bilgi olarak basılır. Admin listesi her koşumda
 * basılır; önceki koşumla aynı olmalı (test hiçbir satırın rolünü değiştirmez). `npm run itest:artik`.
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.POSTGRES_URL_TEST ?? process.env.POSTGRES_URL);
const n = async (q) => Number((await q)[0].n);
const sayimlar = {
  "users clerk_id demo_itest_%": n(sql`select count(*)::int as n from users where clerk_id like 'demo\\_itest\\_%'`),
  "courses slug itest-%": n(sql`select count(*)::int as n from courses where slug like 'itest-%'`),
  "clubs slug itest-%": n(sql`select count(*)::int as n from clubs where slug like 'itest-%'`),
  "events slug itest-%": n(sql`select count(*)::int as n from events where slug like 'itest-%'`),
  "seasons name itest-%": n(sql`select count(*)::int as n from seasons where name like 'itest-%'`),
  "invite_visits ip_hash itest-%": n(sql`select count(*)::int as n from invite_visits where ip_hash like 'itest-%'`),
  "users flagged_at dolu (itest)": n(sql`select count(*)::int as n from users where flagged_at is not null and clerk_id like 'demo\\_itest\\_%'`),
  "cron_runs etkinlik-* (sahipsiz)": n(
    sql`select count(*)::int as n from cron_runs c where c.job in ('etkinlik-host', 'etkinlik-degerlendirme')
      and c.period_key ~ '^[0-9]+$' and not exists (select 1 from events e where e.id = c.period_key::int)`,
  ),
  "cron_runs suistimal-temiz (sahipsiz)": n(
    sql`select count(*)::int as n from cron_runs c where c.job = 'suistimal-temiz' and not exists (select 1 from users u where u.id::text = c.period_key)`,
  ),
};
// Bilgi (çıkış kodunu etkilemez): gerçek işaretler ve admin kararları Faz 5 canlıya çıkınca meşru olur
const bilgi = {
  "users flagged_at dolu (hepsi)": n(sql`select count(*)::int as n from users where flagged_at is not null`),
  "cron_runs suistimal-temiz (hepsi)": n(sql`select count(*)::int as n from cron_runs where job = 'suistimal-temiz'`),
};
let kirli = false;
for (const [ad, p] of Object.entries(sayimlar)) {
  const sayi = await p;
  if (sayi > 0) kirli = true;
  console.log(`${sayi > 0 ? "ARTIK" : "  ok "} ${String(sayi).padStart(4)}  ${ad}`);
}
for (const [ad, p] of Object.entries(bilgi)) console.log(`bilgi ${String(await p).padStart(4)}  ${ad}`);
const adminler = await sql`select id, handle from users where role = 'admin' order by id`;
console.log(`admin: ${adminler.map((a) => `${a.id}:${a.handle}`).join(", ") || "(yok)"}`);
if (kirli) {
  const isaretli = await sql`select id, handle, flagged_at from users where flagged_at is not null order by id`;
  if (isaretli.length) console.log("işaretli:", isaretli.map((u) => `${u.id}:${u.handle}`).join(", "));
  process.exit(1);
}
