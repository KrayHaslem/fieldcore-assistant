import { test, expect } from "@playwright/test";

test.describe("Sales Orders", () => {
  test("SO list shows seeded test data", async ({ page }) => {
    await page.goto("/sales");
    await expect(page.getByText("Manage quotes, orders, and invoices")).toBeVisible();
    await expect(page.getByText("SO-E2E-001")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("E2E Test Customer")).toBeVisible();
  });

  test("SO list shows correct table headers", async ({ page }) => {
    await page.goto("/sales");
    await expect(page.getByText("SO #")).toBeVisible();
    await expect(page.getByText("Customer")).toBeVisible();
    await expect(page.getByText("Status")).toBeVisible();
    await expect(page.getByText("Total")).toBeVisible();
  });

  test("New Order button navigates to create form", async ({ page }) => {
    await page.goto("/sales");
    await page.getByRole("button", { name: /New Order/i }).click();
    await expect(page).toHaveURL("/sales/new");
    await expect(page.getByText("New Sales Order")).toBeVisible();
  });

  test("create SO form has required fields", async ({ page }) => {
    await page.goto("/sales/new");
    await expect(page.getByPlaceholder("Enter customer name")).toBeVisible();
    await expect(page.getByText("Line Items")).toBeVisible();
    await expect(page.getByRole("button", { name: /Add Item/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Save as Quote/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Create Sales Order/i })).toBeVisible();
  });

  test("validation prevents empty customer name", async ({ page }) => {
    await page.goto("/sales/new");
    await page.getByRole("button", { name: /Create Sales Order/i }).click();
    await expect(page.getByText(/Missing customer/i)).toBeVisible({ timeout: 5000 });
  });

  test("can click seeded SO row to view detail", async ({ page }) => {
    await page.goto("/sales");
    await expect(page.getByText("SO-E2E-001")).toBeVisible({ timeout: 10000 });
    await page.getByText("SO-E2E-001").click();
    await expect(page).toHaveURL(/\/sales\/.+/);
  });
});
