import { test, expect } from "@playwright/test";

/**
 * Tests the organization setup wizard flow.
 * 
 * NOTE: This test creates a SECOND test org via the UI (the superadmin creates it
 * from Settings). It exercises the full org setup wizard flow.
 * Since we're logged in as a test admin (not superadmin), these tests verify
 * the wizard UI can render and be navigated when accessed directly.
 */
test.describe("Organization Setup Wizard", () => {
  test("wizard page renders with industry input", async ({ page }) => {
    // Access the wizard directly with the test org ID
    // The wizard should render even if we're already onboarded
    await page.goto("/setup/00000000-0000-0000-0000-e2e000000001");

    await expect(page.getByText(/What industry is your business in/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder(/e.g. Construction/i)).toBeVisible();
  });

  test("wizard shows AI quick setup option", async ({ page }) => {
    await page.goto("/setup/00000000-0000-0000-0000-e2e000000001");

    await expect(page.getByText(/quick setup with AI/i)).toBeVisible();
    await expect(page.getByPlaceholder(/Describe your organization/i)).toBeVisible();
  });

  test("wizard can navigate through steps manually", async ({ page }) => {
    await page.goto("/setup/00000000-0000-0000-0000-e2e000000001");

    // Step 1: Enter industry
    await page.getByPlaceholder(/e.g. Construction/i).fill("E2E Testing Industry");
    await page.getByRole("button", { name: /Next/i }).click();

    // Step 2: Purchase Types
    await expect(page.getByText(/Purchase Types/i)).toBeVisible();
    await expect(page.getByText("Resale")).toBeVisible();
    await expect(page.getByText("Manufacturing Input")).toBeVisible();
    await page.getByRole("button", { name: /Next/i }).click();

    // Step 3: Approval Requirements
    await expect(page.getByText(/Approval Requirements/i)).toBeVisible();
    await page.getByRole("button", { name: /Next/i }).click();

    // Step 4: Departments
    await expect(page.getByText(/Departments/i)).toBeVisible();
    await page.getByRole("button", { name: /Next/i }).click();

    // Step 5: Inventory & Sales
    await expect(page.getByText(/Inventory & Sales/i)).toBeVisible();
    await page.getByRole("button", { name: /Next/i }).click();

    // Step 6: Review / Terms
    await expect(page.getByText(/Review|Terms|Finish|Accept/i)).toBeVisible();
  });

  test("approval step shows threshold field when enabled", async ({ page }) => {
    await page.goto("/setup/00000000-0000-0000-0000-e2e000000001");

    // Go to step 3
    await page.getByPlaceholder(/e.g. Construction/i).fill("Testing");
    await page.getByRole("button", { name: /Next/i }).click();
    await page.getByRole("button", { name: /Next/i }).click();

    // Enable approval
    await expect(page.getByText(/Approval Requirements/i)).toBeVisible();
    const toggle = page.getByRole("switch");
    await toggle.click();

    // Threshold field should appear
    await expect(page.getByPlaceholder(/e.g. 500/i)).toBeVisible();
    await expect(page.getByText(/Approver Role/i)).toBeVisible();
  });

  test("departments step shows name input when enabled", async ({ page }) => {
    await page.goto("/setup/00000000-0000-0000-0000-e2e000000001");

    // Navigate to step 4
    await page.getByPlaceholder(/e.g. Construction/i).fill("Testing");
    await page.getByRole("button", { name: /Next/i }).click();
    await page.getByRole("button", { name: /Next/i }).click();
    await page.getByRole("button", { name: /Next/i }).click();

    // Enable departments
    await expect(page.getByText(/Departments/i)).toBeVisible();
    const toggle = page.getByRole("switch");
    await toggle.click();

    // Department names field should appear
    await expect(page.getByPlaceholder(/e.g. Operations, Engineering/i)).toBeVisible();
  });
});
