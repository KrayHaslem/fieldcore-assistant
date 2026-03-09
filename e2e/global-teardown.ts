import { test as teardown } from "@playwright/test";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

teardown("cleanup test environment", async () => {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !email || !password) {
    console.log("Skipping cleanup — missing env vars");
    return;
  }

  console.log("Cleaning up E2E test environment...");
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/reset-e2e`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        action: "cleanup",
        email,
        password,
      }),
    }
  );

  const result = await response.json();
  if (!response.ok || result.error) {
    console.error(`Cleanup failed: ${result.error ?? response.statusText}`);
  } else {
    console.log("E2E test environment cleaned up successfully.");
  }
});
