import { test, expect } from "@playwright/test";

/**
 * Tests the organization setup wizard flow.
 * 
 * NOTE: Step 0 is the AI quick-setup landing. Step 1+ are manual steps.
 * Steps: 0=AI, 1=Industry, 2=Approval, 3=Departments, 4=Inventory & Sales, 5=Policy
 */
test.describe("Organization Setup Wizard", () => {
  test("wizard page renders with AI quick setup", async ({ page }) => {
    await page.goto("/setup/00000000-0000-0000-0000-e2e000000001");

    await expect(page.getByText(/Quick Setup with AI/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder(/Describe your organization/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Skip, enter manually/i })).toBeVisible();
  });

  test("skip AI goes to industry step", async ({ page }) => {
    await page.goto("/setup/00000000-0000-0000-0000-e2e000000001");

    await page.getByRole("button", { name: /Skip, enter manually/i }).click();
    await expect(page.getByText(/What industry is your business in/i)).toBeVisible();
    await expect(page.getByPlaceholder(/e.g. Construction/i)).toBeVisible();
  });

  test("wizard can navigate through steps manually", async ({ page }) => {
    await page.goto("/setup/00000000-0000-0000-0000-e2e000000001");

    // Step 0: Skip AI
    await page.getByRole("button", { name: /Skip, enter manually/i }).click();

    // Step 1: Enter industry
    await page.getByPlaceholder(/e.g. Construction/i).fill("E2E Testing Industry");
    await page.getByRole("button", { name: /Next/i }).click();

    // Step 2: Approval Requirements
    await expect(page.getByText(/Approval Requirements/i)).toBeVisible();
    await page.getByRole("button", { name: /Next/i }).click();

    // Step 3: Departments
    await expect(page.getByText(/Departments/i)).toBeVisible();
    await page.getByRole("button", { name: /Next/i }).click();

    // Step 4: Inventory & Sales
    await expect(page.getByText(/Inventory & Sales/i)).toBeVisible();
    await page.getByRole("button", { name: /Next/i }).click();

    // Step 5: Review / Terms
    await expect(page.getByText(/Review|Terms|Finish|Accept|Data Sharing/i)).toBeVisible();
  });

  test("approval step shows threshold field when enabled", async ({ page }) => {
    await page.goto("/setup/00000000-0000-0000-0000-e2e000000001");

    // Skip AI, go to step 2 (Approval)
    await page.getByRole("button", { name: /Skip, enter manually/i }).click();
    await page.getByPlaceholder(/e.g. Construction/i).fill("Testing");
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

    // Skip AI, navigate to step 3 (Departments)
    await page.getByRole("button", { name: /Skip, enter manually/i }).click();
    await page.getByPlaceholder(/e.g. Construction/i).fill("Testing");
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
