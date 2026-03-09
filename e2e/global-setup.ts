import { test as setup, expect } from "@playwright/test";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

setup("reset test environment and authenticate", async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "E2E_USER_EMAIL and E2E_USER_PASSWORD environment variables are required"
    );
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY environment variables are required"
    );
  }

  // Step 1: Call reset-e2e edge function to wipe and recreate test org + user
  console.log("Resetting E2E test environment...");
  const resetResponse = await fetch(
    `${SUPABASE_URL}/functions/v1/reset-e2e`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        "x-e2e-secret": process.env.E2E_RESET_SECRET ?? "",
      },
      body: JSON.stringify({
        action: "reset",
        email,
        password,
        full_name: "E2E Test Admin",
      }),
    }
  );

  const resetResult = await resetResponse.json();
  if (!resetResponse.ok || resetResult.error) {
    throw new Error(`Failed to reset E2E environment: ${resetResult.error ?? resetResponse.statusText}`);
  }
  console.log(`E2E environment reset complete. Test org: ${resetResult.org_id}, user: ${resetResult.email}`);

  // Step 2: Sign in via the UI
  await page.goto("/auth");
  await expect(
    page.getByRole("heading", { name: /FieldCore Resource Systems/i })
  ).toBeVisible();

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /Sign In/i }).click();

  // Wait for redirect to dashboard
  await expect(page).toHaveURL("/", { timeout: 15000 });
  await expect(page.getByText(/Welcome back/i)).toBeVisible({ timeout: 10000 });

  // Save auth state for all other tests
  await page.context().storageState({ path: "e2e/.auth/user.json" });
  console.log("Authentication state saved.");
});
