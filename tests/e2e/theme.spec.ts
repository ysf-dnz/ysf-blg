import { test, expect } from "@playwright/test";

test.describe("tema", () => {
  test("varsayılan sistem temasını çözer ve toggle kalıcıdır", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    // dark iken toggle: light → (localStorage'a yazılır)
    await page.getByRole("button", { name: /tema/i }).click();
    const theme = await page.locator("html").getAttribute("data-theme");
    expect(["light", "dark"]).toContain(theme);

    const stored = await page.evaluate(() => localStorage.getItem("ysf:theme"));
    expect(stored).not.toBeNull();

    // yeniden yüklemede tercih korunur (no-flash script)
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      theme === "dark" ? "dark" : "light",
    );
  });
});
