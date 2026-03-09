import { test, expect } from "@playwright/test";

test.describe("PO Groups", () => {
  test("PO Groups page loads", async ({ page }) => {
    await page.goto("/po-groups");
    // Page should load (may show content or "no groups" message)
    await expect(page.getByText(/PO Group/i)).toBeVisible({ timeout: 10000 });
  });

  test("can navigate to create new group", async ({ page }) => {
    await page.goto("/po-groups");
    const newBtn = page.getByRole("button", { name: /New/i });
    if (await newBtn.isVisible()) {
      await newBtn.click();
      await expect(page).toHaveURL("/po-groups/new");
    }
  });
});
