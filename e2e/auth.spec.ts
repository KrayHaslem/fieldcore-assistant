import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test.use({ storageState: undefined }); // Don't use saved auth for these tests

  test("login page renders correctly", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByRole("heading", { name: /FieldCore Resource Systems/i })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: /Sign In/i })).toBeVisible();
  });

  test("shows error for invalid credentials", async ({ page }) => {
    await page.goto("/auth");
    await page.getByLabel("Email").fill("invalid@test.com");
    await page.getByLabel("Password").fill("wrongpassword");
    await page.getByRole("button", { name: /Sign In/i }).click();

    // Should show an error toast/message
    await expect(page.getByText(/Invalid login credentials/i)).toBeVisible({ timeout: 10000 });
  });

  test("can toggle between sign in and sign up", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByText(/Don't have an account/i)).toBeVisible();

    await page.getByRole("button", { name: /Sign Up/i }).click();
    await expect(page.getByLabel("Full Name")).toBeVisible();
    await expect(page.getByRole("button", { name: /Create Account/i })).toBeVisible();

    await page.getByRole("button", { name: /Sign In/i }).click();
    await expect(page.getByLabel("Full Name")).not.toBeVisible();
  });

  test("unauthenticated users are redirected to /auth", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/auth");
  });
});

test.describe("Authenticated Session", () => {
  test("successful login shows dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Welcome back/i)).toBeVisible();
  });

  test("logout returns to auth page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Welcome back/i)).toBeVisible();

    // Click sign out button in sidebar
    await page.getByTitle("Sign out").click();
    await expect(page).toHaveURL("/auth", { timeout: 10000 });
  });
});
