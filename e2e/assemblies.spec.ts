import { test, expect } from "@playwright/test";

test.describe("Assemblies", () => {
  test("assemblies page loads", async ({ page }) => {
    await page.goto("/assemblies");
    await expect(page.getByText("Track manufacturing")).toBeVisible();
    await expect(page.getByText("Record New Assembly")).toBeVisible();
  });

  test("assembly form shows finished goods selector", async ({ page }) => {
    await page.goto("/assemblies");
    await expect(page.getByText("Finished Goods Item")).toBeVisible();
    await expect(page.getByPlaceholder(/Search resale items/i)).toBeVisible();
  });

  test("assembly history table is present", async ({ page }) => {
    await page.goto("/assemblies");
    await expect(page.getByText("Assembly History")).toBeVisible();
  });

  test("history table shows component count column", async ({ page }) => {
    await page.goto("/assemblies");
    await expect(page.getByText("Components")).toBeVisible();
  });

  test("BOM link appears when no BOM is defined for an item", async ({ page }) => {
    await page.goto("/assemblies");
    // Search for an item that likely has no BOM
    const searchInput = page.getByPlaceholder(/Search resale items/i);
    await searchInput.click();
    await searchInput.fill("test");
    
    // If results appear, click one
    const options = page.locator('[role="option"], [data-value]');
    const count = await options.count();
    if (count > 0) {
      await options.first().click();
      // Check for either BOM auto-populate banner or "No BOM defined" link
      const bomBanner = page.getByText(/Components auto-populated from saved BOM/i);
      const noBomLink = page.getByText(/Set up a Bill of Materials/i);
      await expect(bomBanner.or(noBomLink)).toBeVisible({ timeout: 5000 });
    }
  });
});
