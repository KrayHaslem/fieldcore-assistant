import { test, expect } from "@playwright/test";

test.describe("Assemblies", () => {
  test("assemblies page loads with tabs", async ({ page }) => {
    await page.goto("/assemblies");
    await expect(page.getByText("Assemblies & BOM")).toBeVisible();
    await expect(page.getByRole("tab", { name: /Record Assembly/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Bill of Materials/i })).toBeVisible();
  });

  test("assembly form shows finished goods selector", async ({ page }) => {
    await page.goto("/assemblies");
    await expect(page.getByText("Finished Goods Item")).toBeVisible();
    await expect(page.getByPlaceholder(/Search resale items/i)).toBeVisible();
  });

  test("selecting a seeded resale item auto-populates BOM components", async ({ page }) => {
    await page.goto("/assemblies");
    const searchInput = page.getByPlaceholder(/Search resale items/i);
    await searchInput.click();
    await searchInput.fill("E2E Resale");

    // Wait for and click the option
    const option = page.getByText("E2E Resale Widget").first();
    await expect(option).toBeVisible({ timeout: 5000 });
    await option.click();

    // BOM banner should appear since we seeded a BOM entry
    await expect(page.getByText(/Components auto-populated from saved BOM/i)).toBeVisible({ timeout: 5000 });

    // The component "E2E Mfg Input Part" should be auto-populated
    await expect(page.getByText("E2E Mfg Input Part")).toBeVisible();
  });

  test("assembly history table is present", async ({ page }) => {
    await page.goto("/assemblies");
    await expect(page.getByText("Assembly History")).toBeVisible();
  });

  test("history table shows component count column", async ({ page }) => {
    await page.goto("/assemblies");
    await expect(page.getByText("Components")).toBeVisible();
  });
});
