import { test, expect } from "@playwright/test";

test.describe("Reconciliation", () => {
  test("reconciliation page loads", async ({ page }) => {
    await page.goto("/reconciliation");
    await expect(page.getByText("Compare expected vs actual")).toBeVisible();
    await expect(page.getByText("Start New Reconciliation")).toBeVisible();
  });

  test("search item field is present", async ({ page }) => {
    await page.goto("/reconciliation");
    await expect(page.getByPlaceholder(/Search inventory items/i)).toBeVisible();
  });

  test("reconciliation history table is present", async ({ page }) => {
    await page.goto("/reconciliation");
    await expect(page.getByText("Reconciliation History")).toBeVisible();
    await expect(page.getByText("Expected")).toBeVisible();
    await expect(page.getByText("Actual")).toBeVisible();
    await expect(page.getByText("Variance")).toBeVisible();
  });
});
