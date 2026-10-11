import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  // Lokalde 1: soğuk dev sunucuda ilk derleme/Pagefind yüklemesi tek seferlik zaman aşımı üretebiliyor
  retries: process.env.CI ? 2 : 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:4321",
    trace: "on-first-retry",
    // dev-server ilk derlemesi sayfa başına saniyeler sürebilir
    navigationTimeout: 30_000,
  },
  expect: { timeout: 15_000 },
  // Dev sunucuda ilk derleme + eşzamanlı yük: 30 sn varsayılanı yanlış kırmızı üretiyordu
  timeout: 60_000,
  globalSetup: "./tests/e2e/global-setup.ts",
  projects: [
    { name: "misafir", testIgnore: /auth\.spec|kurs\.spec/ },
    // Clerk test üyesi tek: oturumlar çakışmasın diye seri + tek worker
    { name: "auth", testMatch: /auth\.spec|kurs\.spec/, fullyParallel: false, workers: 1 },
  ],
  webServer: {
    // Server-mode sonrası: Vercel adapter `astro preview`ü desteklemez
    // (D0 ölçümüyle kanıtlandı). SSR rotalar dahil gerçek koşum dev'de;
    // üretim çıktısı doğrulaması tests/unit/build-output ile yapılır.
    command: "npm run dev",
    url: "http://localhost:4321",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
