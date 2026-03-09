import { test, expect } from "@playwright/test";

test.describe("Purchase Orders", () => {
  test("PO list shows seeded test data", async ({ page }) => {
    await page.goto("/purchase-orders");
    await expect(page.getByText("Manage purchasing workflows")).toBeVisible();
    // Seeded PO should appear
    await expect(page.getByText("PO-E2E-001")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("E2E Supplier Alpha")).toBeVisible();
  });

  test("PO list shows correct table headers", async ({ page }) => {
    await page.goto("/purchase-orders");
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

  test("validation shows error when submitting without supplier", async ({ page }) => {
    await page.goto("/purchase-orders/new");
    await page.getByRole("button", { name: /Save as Draft/i }).click();
    await expect(page.getByText(/Please select a supplier/i)).toBeVisible({ timeout: 5000 });
  });

  test("can click seeded PO row to view detail", async ({ page }) => {
    await page.goto("/purchase-orders");
    await expect(page.getByText("PO-E2E-001")).toBeVisible({ timeout: 10000 });
    await page.getByText("PO-E2E-001").click();
    await expect(page).toHaveURL(/\/purchase-orders\/.+/);
  });
});
