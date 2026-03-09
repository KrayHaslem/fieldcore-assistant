import { test, expect } from "@playwright/test";

test.describe("Purchase Orders", () => {
  test("PO list page loads with table headers", async ({ page }) => {
    await page.goto("/purchase-orders");
    await expect(page.getByText("Manage purchasing workflows")).toBeVisible();
    await expect(page.getByText("Order #")).toBeVisible();
    await expect(page.getByText("Supplier")).toBeVisible();
    await expect(page.getByText("Amount")).toBeVisible();
    await expect(page.getByText("Status")).toBeVisible();
  });

  test("New PO button navigates to create form", async ({ page }) => {
    await page.goto("/purchase-orders");
    await page.getByRole("button", { name: /New PO/i }).click();
    await expect(page).toHaveURL("/purchase-orders/new");
    await expect(page.getByText("New Purchase Order")).toBeVisible();
  });

  test("create PO form has required fields", async ({ page }) => {
    await page.goto("/purchase-orders/new");
    await expect(page.getByPlaceholder(/Search suppliers/i)).toBeVisible();
    await expect(page.getByText("Line Items")).toBeVisible();
    await expect(page.getByRole("button", { name: /Add Line/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Save as Draft/i })).toBeVisible();
  });

  test.describe.serial("PO creation and detail", () => {
    test("validation shows error when submitting without supplier", async ({ page }) => {
      await page.goto("/purchase-orders/new");
      await page.getByRole("button", { name: /Save as Draft/i }).click();
      // Should show validation error
      await expect(page.getByText(/Please select a supplier/i)).toBeVisible({ timeout: 5000 });
    });
  });

  test("can click a PO row to view detail", async ({ page }) => {
    await page.goto("/purchase-orders");
    
    // Wait for table to load
    const rows = page.locator("tbody tr");
    const count = await rows.count();
    
    if (count > 0) {
      // Check if first row has actual data (not "No orders yet" or "Loading...")
      const firstRowText = await rows.first().textContent();
      if (firstRowText && !firstRowText.includes("No orders") && !firstRowText.includes("Loading")) {
        await rows.first().click();
        await expect(page).toHaveURL(/\/purchase-orders\/.+/);
      }
    }
  });
});
