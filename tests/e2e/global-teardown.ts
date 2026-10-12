import { neon } from "@neondatabase/serverless";

// Dev = canlı DB: mesaj.spec'in test üyesi adına açtığı üye/mesaj şikâyetleri canlı admin kuyruğunda
// kalmasın. Yalnız test üyesinin (e2e+clerk_test) kendi şikâyetleri silinir.
export default async function globalTeardown() {
  try {
    process.loadEnvFile(".env.local");
  } catch {}
  if (!process.env.POSTGRES_URL || !process.env.E2E_CLERK_ID) return;
  const sql = neon(process.env.POSTGRES_URL);
  await sql`
    delete from reports r using users u
    where u.id = r.reporter_id and u.clerk_id = ${process.env.E2E_CLERK_ID}
      and r.target_type in ('user', 'message')`;
}
