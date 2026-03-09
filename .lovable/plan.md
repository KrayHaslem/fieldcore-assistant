

## Playwright E2E Test Suite + GitHub Actions CI

### Overview
Add Playwright end-to-end tests covering all major application flows, plus a GitHub Actions workflow file to run them on push/PR. Since the app requires authentication and a live backend, tests will use a shared auth setup via Playwright's `storageState` pattern.

### Files to Create

**1. `playwright.config.ts`** — Playwright configuration
- Base URL: `http://localhost:8080`
- Projects: chromium, firefox, webkit (desktop), plus mobile-chrome
- `globalSetup` pointing to auth setup file
- `webServer` config to run `npm run dev` before tests
- Screenshot on failure, trace on first retry

**2. `e2e/global-setup.ts`** — Shared auth login
- Uses Playwright's `request` API to sign in via the app's auth page
- Saves `storageState` to `e2e/.auth/user.json` for reuse across all tests
- Reads credentials from `E2E_USER_EMAIL` and `E2E_USER_PASSWORD` env vars

**3. Test files** (one per major feature area):

| File | Coverage |
|------|----------|
| `e2e/auth.spec.ts` | Login form renders, invalid credentials show error, successful login redirects to dashboard, logout returns to auth page |
| `e2e/dashboard.spec.ts` | Dashboard loads with stat cards, navigation sidebar links work |
| `e2e/purchase-orders.spec.ts` | PO list loads, create new PO form, view PO detail, status transitions |
| `e2e/po-groups.spec.ts` | PO Groups list, create/view group detail |
| `e2e/sales-orders.spec.ts` | SO list loads, create new SO form, view SO detail |
| `e2e/inventory.spec.ts` | Inventory page loads with items table, filters/search work |
| `e2e/assemblies.spec.ts` | Assembly form renders, BOM auto-populate when selecting finished item, stock validation warning, save assembly, history table shows component count |
| `e2e/reconciliation.spec.ts` | Reconciliation page loads, basic interaction |
| `e2e/reports.spec.ts` | Reports page loads, SQL assistant panel opens |
| `e2e/settings.spec.ts` | Settings tabs render (org, users, suppliers, items, units, BOM, reports), BOM tab CRUD (add/edit/delete component), user role management |

**4. `.github/workflows/e2e.yml`** — GitHub Actions workflow
- Triggers: push to `main`, pull requests to `main`
- Steps: checkout, install Node, install deps, install Playwright browsers, run `npx playwright test`
- Env vars: `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` from GitHub secrets
- Upload test report as artifact on failure

**5. `e2e/.gitignore`** — Ignore `.auth/` directory and test results

### Test Strategy
- All authenticated tests reuse the saved `storageState` — no repeated login
- Tests use `test.describe.serial()` where order matters (e.g., create then view)
- Each test file is independent and can run in parallel across browsers
- Tests assert on visible UI text and accessible roles, not implementation details
- Destructive operations (delete) are tested last within their serial group

### Package Changes
- Add `@playwright/test` as a devDependency
- Add scripts: `"test:e2e": "playwright test"`, `"test:e2e:ui": "playwright test --ui"`

