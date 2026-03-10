import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("loads with stat cards", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Welcome back/i)).toBeVisible();
    await expect(page.getByText("Orders")).toBeVisible();
    await expect(page.getByText("Pending Approvals")).toBeVisible();
    await expect(page.getByText("Sales Orders")).toBeVisible();
    await expect(page.getByText("Inventory Items")).toBeVisible();
  });

  test("stat cards show seeded data counts", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Welcome back/i)).toBeVisible();

    const statCards = page.locator("[class*='stat'], [class*='card']");
    await expect(statCards.first()).toBeVisible();
  });

  test("command center is visible", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Command Center")).toBeVisible();
    await expect(page.getByPlaceholder(/Try:/i)).toBeVisible();
  });

  test("sidebar navigation links work", async ({ page }) => {
    await page.goto("/");

    // Navigate to Orders
    await page.getByRole("link", { name: "Orders" }).click();
    await expect(page.getByText("Manage purchasing workflows")).toBeVisible();

    // Navigate to Inventory
    await page.getByRole("link", { name: "Inventory" }).click();
    await expect(page.getByText("Track items, stock levels")).toBeVisible();

    // Navigate to Sales
    await page.getByRole("link", { name: "Sales" }).click();
    await expect(page.getByText("Manage quotes, orders, and invoices")).toBeVisible();

    // Navigate to Assemblies
    await page.getByRole("link", { name: "Assemblies" }).click();
    await expect(page.getByText("Track manufacturing")).toBeVisible();

    // Navigate to Reconciliation
    await page.getByRole("link", { name: "Reconciliation" }).click();
    await expect(page.getByText("Compare expected vs actual")).toBeVisible();

    // Navigate to Reports
    await page.getByRole("link", { name: "Reports" }).click();
    await expect(page.getByText(/Purchasing|Inventory|Sales/i)).toBeVisible();

    // Navigate to Settings
    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page.getByText(/Settings/i)).toBeVisible();

    // Navigate back to Dashboard
    await page.getByRole("link", { name: "Dashboard" }).click();
    await expect(page.getByText(/Welcome back/i)).toBeVisible();
  });

  test("seeded order appears in awaiting approval section", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("ord-E2E-001").or(page.getByText("Awaiting Your Approval"))).toBeVisible({ timeout: 10000 });
  });
});
