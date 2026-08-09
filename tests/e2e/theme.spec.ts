import { test, expect } from "@playwright/test";

test.describe("tema", () => {
  test("varsayılan sistem temasını çözer ve toggle kalıcıdır", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    // Toggle: tema değişimi startViewTransition İÇİNDE uygulanır (asenkron)
    // — bu yüzden tıklama sonrası attribute'u poll'la bekleriz.
    await page.getByRole("button", { name: /tema/i }).click();
    await expect
      .poll(async () => page.evaluate(() => localStorage.getItem("ysf:theme")))
      .not.toBeNull();
    const stored = await page.evaluate(() => localStorage.getItem("ysf:theme"));
    // sistem tercihi dark iken döngü: system → light
    const beklenen =
      stored === "dark" || stored === "system" ? "dark" : "light";
    await expect(page.locator("html")).toHaveAttribute("data-theme", beklenen);

    // yeniden yüklemede tercih korunur (no-flash script)
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", beklenen);
  });
});
