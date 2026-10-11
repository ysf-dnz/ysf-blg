import { createClerkClient } from "@clerk/backend";
import { clerkSetup } from "@clerk/testing/playwright";

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
  if (data.length === 0) {
    await clerk.users.createUser({ emailAddress: [emailAddress], skipPasswordRequirement: true });
  }
}
