import { test, expect } from "@playwright/test";

test.describe("Inventory", () => {
  test("inventory page shows seeded items", async ({ page }) => {
    await page.goto("/inventory");
    await expect(page.getByText("Track items, stock levels")).toBeVisible();
    await expect(page.getByText("E2E Resale Widget")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("E2E Mfg Input Part")).toBeVisible();
    await expect(page.getByText("E2E Consumable Item")).toBeVisible();
  });

  test("inventory table shows correct headers", async ({ page }) => {
    await page.goto("/inventory");
    await expect(page.getByText("Item")).toBeVisible();
    await expect(page.getByText("SKU")).toBeVisible();
    await expect(page.getByText("Type")).toBeVisible();
    await expect(page.getByText("On Hand")).toBeVisible();
    await expect(page.getByText("Unit Cost")).toBeVisible();
  });

  test("seeded items show correct SKUs", async ({ page }) => {
    await page.goto("/inventory");
    await expect(page.getByText("E2E-RW-01")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("E2E-MI-01")).toBeVisible();
    await expect(page.getByText("E2E-CS-01")).toBeVisible();
  });

  test("Add Item button opens dialog", async ({ page }) => {
    await page.goto("/inventory");
    await page.getByRole("button", { name: /Add Item/i }).click();
    await expect(page.getByText("New Inventory Item")).toBeVisible();
    await expect(page.getByText("Item Name")).toBeVisible();
  });

  test("dialog can be closed via Cancel", async ({ page }) => {
    await page.goto("/inventory");
    await page.getByRole("button", { name: /Add Item/i }).click();
    await expect(page.getByText("New Inventory Item")).toBeVisible();
    await page.getByRole("button", { name: /Cancel/i }).click();
    await expect(page.getByText("New Inventory Item")).not.toBeVisible();
  });

  test("Create Item button is disabled without name", async ({ page }) => {
    await page.goto("/inventory");
    await page.getByRole("button", { name: /Add Item/i }).click();
    const createBtn = page.getByRole("button", { name: /Create Item/i });
    await expect(createBtn).toBeDisabled();
  });
});
