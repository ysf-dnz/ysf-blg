import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:4321",
    trace: "on-first-retry",
    // dev-server ilk derlemesi sayfa başına saniyeler sürebilir
    navigationTimeout: 30_000,
  },
  expect: { timeout: 15_000 },
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
