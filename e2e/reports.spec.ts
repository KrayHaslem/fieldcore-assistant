import { test, expect } from "@playwright/test";

test.describe("Reports", () => {
  test("reports page loads with categories", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.getByText("Purchasing")).toBeVisible();
    await expect(page.getByText("Inventory")).toBeVisible();
    await expect(page.getByText("Sales")).toBeVisible();
  });

  test("can select a report from the list", async ({ page }) => {
    await page.goto("/reports");
    
    // Click on a purchasing report
    const spendingReport = page.getByText("Spending by Supplier");
    if (await spendingReport.isVisible()) {
      await spendingReport.click();
      // Should show date range controls or report content
      await expect(page.getByText(/Start|From|Date/i)).toBeVisible({ timeout: 5000 });
    }
  });

  test("date range quick selectors are available", async ({ page }) => {
    await page.goto("/reports");
    
    // Select any report that has date range
    const report = page.getByText("Spending by Supplier");
    if (await report.isVisible()) {
      await report.click();
      // Check for quick date range buttons
      await expect(page.getByText(/This Month|Last Month|This Quarter/i).first()).toBeVisible({ timeout: 5000 });
    }
  });
});
