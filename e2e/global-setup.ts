import { test as setup, expect } from "@playwright/test";

setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "E2E_USER_EMAIL and E2E_USER_PASSWORD environment variables are required"
    );
  }

  await page.goto("/auth");
  await expect(page.getByRole("heading", { name: /FieldCore Resource Systems/i })).toBeVisible();

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /Sign In/i }).click();

  // Wait for redirect to dashboard
  await expect(page).toHaveURL("/", { timeout: 15000 });
  await expect(page.getByText(/Welcome back/i)).toBeVisible({ timeout: 10000 });

  // Save auth state
  await page.context().storageState({ path: "e2e/.auth/user.json" });
});
