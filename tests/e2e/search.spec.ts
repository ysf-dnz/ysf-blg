import { test, expect } from "@playwright/test";

test.describe("arama (Pagefind)", () => {
  test("Türkçe karakterli sorgu sonuç döner", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /ara/i }).click();

    const dialog = page.locator("#search-dialog");
    await expect(dialog).toBeVisible();

    const input = dialog.locator("input");
    await input.fill("öğrenme");
    await expect(dialog.locator(".pagefind-ui__result").first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(dialog.locator(".pagefind-ui__result").first()).toContainText(
      /NotebookLM/i,
    );
  });

  test("Cmd+K kısayolu aramayı açar", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.locator("#search-dialog")).toBeVisible();
  });
});
