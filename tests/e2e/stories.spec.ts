import { test, expect } from "@playwright/test";

test.describe("hikâye halkaları", () => {
  test("slide'lı hikâye site içi viewer'da açılır ve gezinilir", async ({
    page,
  }) => {
    await page.goto("/");
    const ring = page.locator("[data-story-id][data-slides]").first();
    await expect(ring).toBeVisible();
    await ring.click();

    const viewer = page.locator("#story-viewer");
    await expect(viewer).toBeVisible();
    await expect(viewer.locator(".sv-slide-title")).toContainText(/NotebookLM/i);

    // sonraki slide'a geç → CTA görünür
    await viewer.locator(".sv-next").click();
    await expect(viewer.locator(".sv-cta")).toBeVisible();

    // kapat → halka "seen" olur
    await viewer.locator(".sv-close").click();
    await expect(viewer).not.toBeVisible();
    await expect(ring).toHaveClass(/seen/);

    const seen = await page.evaluate(() =>
      localStorage.getItem("ysf:stories:seen"),
    );
    expect(seen).toContain("yeni-yazi-notebooklm");
  });

  test("slide'sız hikâye doğrudan dış link taşır", async ({ page }) => {
    await page.goto("/");
    const ring = page.locator("[data-story-id]:not([data-slides])").first();
    await expect(ring).toHaveAttribute("href", /^https?:\/\//);
    await expect(ring).toHaveAttribute("target", "_blank");
  });

  test("deep-link sayfası JS'siz fallback içerir", async ({ page }) => {
    await page.goto("/hikaye/yeni-yazi-notebooklm");
    await expect(page.locator("ol li")).toHaveCount(2);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex",
    );
  });
});
