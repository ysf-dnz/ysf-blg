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
    await neon(process.env.POSTGRES_URL)`
      insert into event_staff (event_id, user_id, role)
      select e.id, u.id, 'scanner' from events e, users u
      where e.slug = 'go-okuma-maratonu-demo' and u.clerk_id = ${clerkId}
      on conflict do nothing`;
  }
}
