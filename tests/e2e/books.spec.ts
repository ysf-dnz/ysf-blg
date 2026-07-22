import { test, expect } from "@playwright/test";

const MINDSET = "/kutuphane/kitap/1JlqnQCbEoW5DGVOXte4O88AdSofFbH2Z";

test.describe("kitap rafı", () => {
  test("rafta kategoriler ve kapaklı kartlar var, kart detaya gider", async ({
    page,
  }) => {
    await page.goto("/kutuphane");
    const shelf = page.locator("details").first();
    await expect(shelf).toBeVisible();
    const firstBook = page.locator('a[href^="/kutuphane/kitap/"]').first();
    await expect(firstBook).toBeVisible();
    await firstBook.click();
    await expect(page).toHaveURL(/\/kutuphane\/kitap\//);
  });

  test("kitap detayında çekmeceler açılıp kapanır", async ({ page }) => {
    await page.goto(MINDSET);
    await expect(page.getByRole("heading", { name: "Mindset" })).toBeVisible();

    const drawer = page.locator("details").first();
    const answer = drawer.locator(".prose");
    await expect(answer).not.toBeVisible();
    await drawer.locator("summary").click();
    await expect(answer).toBeVisible();
    await expect(answer).toContainText(/zihniyet/i);
  });

  test("Drive önizlemesi gömülü ve indirme kaçışları kapalı", async ({
    page,
  }) => {
    await page.goto(MINDSET);
    const iframe = page.locator("iframe[src*='drive.google.com']");
    await expect(iframe).toHaveAttribute("src", /preview/);
    // sandbox popup açılmasını engeller (allow-popups YOK)
    const sandbox = await iframe.getAttribute("sandbox");
    expect(sandbox).not.toContain("allow-popups");
    // sayfada doğrudan Drive görüntüleme/indirme linki kalmadı
    await expect(
      page.locator("a[href*='drive.google.com/file']"),
    ).toHaveCount(0);
  });

  test("sohbet butonu NotebookLM defterine işaret eder", async ({ page }) => {
    await page.goto(MINDSET);
    const chat = page.getByRole("link", { name: /Kitapla sohbet et/i });
    await expect(chat).toHaveAttribute(
      "href",
      /notebooklm\.google\.com\/notebook\//,
    );
    await expect(chat).toHaveAttribute("target", "_blank");
  });
});
