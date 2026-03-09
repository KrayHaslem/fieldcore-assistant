import { test, expect } from "@playwright/test";

test.describe("Inventory", () => {
  test("inventory page loads with table headers", async ({ page }) => {
    await page.goto("/inventory");
    await expect(page.getByText("Track items, stock levels")).toBeVisible();
    await expect(page.getByText("Item")).toBeVisible();
    await expect(page.getByText("SKU")).toBeVisible();
    await expect(page.getByText("Type")).toBeVisible();
    await expect(page.getByText("On Hand")).toBeVisible();
    await expect(page.getByText("Unit Cost")).toBeVisible();
  });

  test("Add Item button opens dialog", async ({ page }) => {
    await page.goto("/inventory");
    await page.getByRole("button", { name: /Add Item/i }).click();
    await expect(page.getByText("New Inventory Item")).toBeVisible();
    await expect(page.getByText("Item Name")).toBeVisible();
    await expect(page.getByText("SKU")).toBeVisible();
    await expect(page.getByText("Item Type")).toBeVisible();
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
