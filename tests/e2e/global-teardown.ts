import { neon } from "@neondatabase/serverless";

// Dev = canlı DB: mesaj.spec'in test üyesi adına açtığı üye/mesaj şikâyetleri canlı admin kuyruğunda
// kalmasın. Yalnız test üyesinin (e2e+clerk_test) kendi şikâyetleri silinir.
export default async function globalTeardown() {
  try {
    process.loadEnvFile(".env.local");
  } catch {}
  if (!process.env.POSTGRES_URL) return;
  const sql = neon(process.env.POSTGRES_URL);
  // ekonomi.spec demo üyeyi (Elif) kısa süre işaretler; test yarıda kalırsa işaret canlıda kalmasın.
  // Demo üyeler (clerk_id demo_*) gerçek hesap değildir: taramanın da şikâyetin de konusu olmazlar.
  await sql`update users set flagged_at = null where handle = 'elif-celik' and clerk_id like 'demo%'`;
  // auth.spec'in işaretli kuklası ve test üyesine açtığı tutulan satır (yarıda kalan koşum): yalnız kukla
  // silinse satır tutulmayı bırakıp olgunlaşırdı — ikisi birlikte süpürülür
  await sql`delete from pending_points where ref_id like 'course:itest-e2e-%'`;
  await sql`delete from users where clerk_id like 'demo\\_itest\\_e2e\\_%'`;
  if (!process.env.E2E_CLERK_ID) return;
  await sql`
    delete from reports r using users u
    where u.id = r.reporter_id and u.clerk_id = ${process.env.E2E_CLERK_ID}
      and r.target_type in ('user', 'message')`;
}
