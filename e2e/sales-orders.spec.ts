import { test, expect } from "@playwright/test";

test.describe("Sales Orders", () => {
  test("SO list page loads with table headers", async ({ page }) => {
    await page.goto("/sales");
    await expect(page.getByText("Manage quotes, orders, and invoices")).toBeVisible();
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

  test("can click an SO row to view detail", async ({ page }) => {
    await page.goto("/sales");
    const rows = page.locator("tbody tr");
    const count = await rows.count();
    
    if (count > 0) {
      const firstRowText = await rows.first().textContent();
      if (firstRowText && !firstRowText.includes("No sales orders") && !firstRowText.includes("Loading")) {
        await rows.first().click();
        await expect(page).toHaveURL(/\/sales\/.+/);
      }
    }
  });
});
