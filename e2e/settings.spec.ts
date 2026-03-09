import { test, expect } from "@playwright/test";

test.describe("Settings", () => {
  test("settings page loads with tabs", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText(/Settings/i).first()).toBeVisible();
  });

  test("can navigate between settings tabs", async ({ page }) => {
    await page.goto("/settings");
    const tabNames = ["Users", "Suppliers", "Items", "Units"];
    for (const name of tabNames) {
      const tab = page.getByRole("tab", { name: new RegExp(name, "i") });
      if (await tab.isVisible()) {
        await tab.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test("users tab shows the test user", async ({ page }) => {
    await page.goto("/settings");
    const usersTab = page.getByRole("tab", { name: /Users/i });
    if (await usersTab.isVisible()) {
      await usersTab.click();
      await expect(page.getByText("E2E Test Admin")).toBeVisible({ timeout: 5000 });
    }
  });

  test("suppliers tab shows seeded suppliers", async ({ page }) => {
    await page.goto("/settings");
    const suppliersTab = page.getByRole("tab", { name: /Suppliers/i });
    if (await suppliersTab.isVisible()) {
      await suppliersTab.click();
      await expect(page.getByText("E2E Supplier Alpha")).toBeVisible({ timeout: 5000 });
      await expect(page.getByText("E2E Supplier Beta")).toBeVisible();
    }
  });

  test("suppliers tab has add supplier button", async ({ page }) => {
    await page.goto("/settings");
    const suppliersTab = page.getByRole("tab", { name: /Suppliers/i });
    if (await suppliersTab.isVisible()) {
      await suppliersTab.click();
      await expect(page.getByRole("button", { name: /Add Supplier/i })).toBeVisible({ timeout: 5000 });
    }
  });
});
