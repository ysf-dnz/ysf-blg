import { test, expect } from "@playwright/test";

test.describe("arama (Pagefind)", () => {
  test("Türkçe karakterli sorgu sonuç döner", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /ara/i }).click();

    const dialog = page.locator("#search-dialog");
    await expect(dialog).toBeVisible();

    const input = dialog.locator("input[type='text']");
    await input.fill("öğrenme");
    await expect(dialog.locator(".pagefind-ui__result").first()).toBeVisible({
      timeout: 10_000,
    });

    // yazı da hâlâ bulunuyor (kitaplarla aynı indekste)
    await input.fill("katmanlı öğrenme");
    await expect(
      dialog.locator(".pagefind-ui__result", { hasText: /NotebookLM/i }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("kitap TR ve EN adıyla bulunur", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("ControlOrMeta+k");
    const dialog = page.locator("#search-dialog");
    const input = dialog.locator("input[type='text']");

    await input.fill("Zihniyet");
    await expect(
      dialog.locator(".pagefind-ui__result", { hasText: /Zihniyet \(Mindset\)/ }).first(),
    ).toBeVisible({ timeout: 10_000 });

    await input.fill("Mindset");
    const sonuc = dialog
      .locator(".pagefind-ui__result", { hasText: /Zihniyet \(Mindset\)/ })
      .first();
    await expect(sonuc).toBeVisible({ timeout: 10_000 });

    // link trailingSlash:never ile uyumlu ve tıklanınca sayfa açılıyor
    const link = sonuc.locator(".pagefind-ui__result-link").first();
    await expect(link).toHaveAttribute("href", /kitap\/[\w-]+$/);
    await link.click();
    await expect(
      page.getByRole("heading", { name: /Mindset/, level: 1 }),
    ).toBeVisible();
  });

  test("Cmd+K kısayolu aramayı açar", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.locator("#search-dialog")).toBeVisible();
  });
});
