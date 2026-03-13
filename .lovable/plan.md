

## Plan: Add `is_onboarded: true` to Innovex seed data

**What**: The seed-demo edge function creates the Innovex organization but doesn't set `is_onboarded` or `terms_accepted_at`. With the new onboarding enforcement, the demo org gets redirected to the setup wizard.

**Change**: Update one line in `supabase/functions/seed-demo/index.ts` (line 91) to include `is_onboarded: true` and `terms_accepted_at: new Date().toISOString()` in the organization upsert.

