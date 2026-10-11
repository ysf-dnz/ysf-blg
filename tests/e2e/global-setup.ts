import { createClerkClient } from "@clerk/backend";
import { clerkSetup } from "@clerk/testing/playwright";
import { neon } from "@neondatabase/serverless";

// Clerk anahtarları .env.local'da; Playwright Astro'nun loadEnv'ini kullanmaz.
// Anahtar yoksa sessizce çıkılır → auth projesi E2E_CLERK_USER boş olduğu için skip.
export default async function globalSetup() {
  try {
    process.loadEnvFile(".env.local");
  } catch {}
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return;

  // Bot-koruma bypass token'ı → process.env.CLERK_TESTING_TOKEN (worker'lara geçer)
  await clerkSetup();

  // Test üyesi idempotent; giriş ticket stratejisiyle (instance'ın e-posta kodu ayarından bağımsız)
  const emailAddress = (process.env.E2E_CLERK_USER ??= "e2e+clerk_test@yusufdeniz.com");
  const clerk = createClerkClient({ secretKey });
  const { data } = await clerk.users.getUserList({ emailAddress: [emailAddress] });
  const clerkId =
    data[0]?.id ?? (await clerk.users.createUser({ emailAddress: [emailAddress], skipPasswordRequirement: true })).id;

  // Görevli tarayıcısı e2e'si (F3-04): test üyesi DEMO maraton etkinliğinde giriş görevlisi olur
  // (idempotent; yalnız seed'in açtığı demo etkinlik). Üyenin DB satırı ilk SSR isteğinde açılır —
  // henüz yoksa satır yazılmaz ve spec kendini atlar. Dev = canlı DB: yalnız demo veriye dokunur.
  if (process.env.POSTGRES_URL) {
    const sql = neon(process.env.POSTGRES_URL);
    await sql`
      insert into event_staff (event_id, user_id, role)
      select e.id, u.id, 'scanner' from events e, users u
      where e.slug = 'go-okuma-maratonu-demo' and u.clerk_id = ${clerkId}
      on conflict do nothing`;
    // Ön koşul gerçekten sağlandıysa bayrak: spec'ler bayrak VARKEN giriş ekranını sert doğrular
    // (regresyon skip'e düşmesin); yalnız ilk koşumda (üye satırı henüz yokken) atlar.
    const [hazir] = await sql`
      select 1 from event_staff s join events e on e.id = s.event_id join users u on u.id = s.user_id
      where e.slug = 'go-okuma-maratonu-demo' and u.clerk_id = ${clerkId}
        and coalesce(e.ends_at, e.starts_at + interval '2 hours') > now() at time zone 'utc'`;
    if (hazir) process.env.E2E_GOREVLI = "1";
  }
}
