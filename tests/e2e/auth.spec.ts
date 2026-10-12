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

// F5-04 (devir §4.4 / §4.5): admin ekranı admin olmayana kapalı; panoda tutulan satır "inceleniyor"
test("admin olmayan üye /uye/admin'e girince /uye'ye yönlendirilir; suistimal kuyruğu görmez", async ({ page }) => {
  test.skip(!process.env.E2E_CLERK_USER, "CLERK_SECRET_KEY yok (.env.local) — auth e2e atlandı");
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: process.env.E2E_CLERK_USER! });
  await page.goto("/uye/admin");
  await expect(page).toHaveURL(/\/uye$/);
  await expect(page.locator("[data-suistimal-kuyrugu]")).toHaveCount(0);
});

test("panoda işaretli kaynaktan doğan olgun bekleyen 'inceleniyor' görünür ve kesinleşmez (işaretin kimde olduğu yazılmaz)", async ({ page }) => {
  test.skip(!process.env.E2E_CLERK_USER || !process.env.POSTGRES_URL || !process.env.E2E_CLERK_ID, "auth e2e için Clerk + DB gerekir");
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.POSTGRES_URL!);
  const [ben] = await sql`select id from users where clerk_id = ${process.env.E2E_CLERK_ID!}`;
  const t = Date.now().toString(36);
  const [kaynak] = await sql`insert into users (clerk_id, handle, name, flagged_at) values (${`demo_itest_e2e_${t}`}, ${`itest-e2e-${t}`}, 'Itest E2E Kaynak', now()) returning id`;
  const refId = `course:itest-e2e-${t}:u:${kaynak!.id}`;
  try {
    await sql`insert into pending_points (user_id, reason, ref_id, delta, note, matures_at)
      values (${ben!.id}, 'course_learner_activated', ${refId}, 5, 'Itest E2E kaynağı kursta aktive oldu', now() - interval '1 hour')`;
    await page.goto("/");
    await clerk.signIn({ page, emailAddress: process.env.E2E_CLERK_USER! });
    await page.goto("/uye");
    const satir = page.locator('[aria-label="Bekleyen puan"] li', { hasText: "Itest E2E kaynağı" });
    await expect(satir).toContainText("inceleniyor");
    await expect(satir).not.toContainText(/işaret|suistimal/i);
    const [row] = await sql`select status from pending_points where user_id = ${ben!.id} and ref_id = ${refId}`;
    expect(row!.status).toBe("pending"); // pano GET'i kesinleştirmedi (tutulan)
  } finally {
    await sql`delete from pending_points where user_id = ${ben!.id} and ref_id = ${refId}`;
    await sql`delete from users where id = ${kaynak!.id}`;
  }
});
