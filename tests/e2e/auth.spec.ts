import { expect, test } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

// Test üyesi tests/e2e/global-setup.ts'te açılır; CLERK_SECRET_KEY yoksa E2E_CLERK_USER boş kalır.
test("test üyesi giriş yapıp panoya ulaşır", async ({ page }) => {
  test.skip(!process.env.E2E_CLERK_USER, "CLERK_SECRET_KEY yok (.env.local) — auth e2e atlandı");
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: process.env.E2E_CLERK_USER! });
  await page.goto("/uye");
  await expect(page).toHaveURL(/\/uye$/);
});
