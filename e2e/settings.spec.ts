import { test, expect } from "@playwright/test";

test.describe("Settings", () => {
  test("settings page loads with tabs", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText(/Settings/i).first()).toBeVisible();
  });

  test("can navigate between settings tabs", async ({ page }) => {
    await page.goto("/settings");
    
    // Check for various tab triggers
    const tabNames = ["Users", "Suppliers", "Items", "Units", "BOM"];
    for (const name of tabNames) {
      const tab = page.getByRole("tab", { name: new RegExp(name, "i") });
      if (await tab.isVisible()) {
        await tab.click();
        // Wait a moment for content to load
        await page.waitForTimeout(500);
      }
    }
  });

  test("BOM tab loads with finished goods selector", async ({ page }) => {
    await page.goto("/settings?tab=bom");
    await expect(page.getByText("Select Finished Good")).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder(/Search resale items/i)).toBeVisible();
  });

  test("users tab shows org members", async ({ page }) => {
    await page.goto("/settings");
    const usersTab = page.getByRole("tab", { name: /Users/i });
    if (await usersTab.isVisible()) {
      await usersTab.click();
      // Should show at least one user (the current user)
      await expect(page.getByText(/admin|procurement|sales|finance|employee/i).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("suppliers tab has add supplier button", async ({ page }) => {
    await page.goto("/settings");
    const suppliersTab = page.getByRole("tab", { name: /Suppliers/i });
    if (await suppliersTab.isVisible()) {
      await suppliersTab.click();
      await expect(page.getByRole("button", { name: /Add Supplier/i })).toBeVisible({ timeout: 5000 });
    }
  });
});
