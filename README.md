# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Running E2E Tests

The project includes a Playwright end-to-end test suite. Tests use a dedicated test organization that is automatically created, seeded, and cleaned up.

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key |
| `E2E_USER_EMAIL` | Email for the test user (created automatically) |
| `E2E_USER_PASSWORD` | Password for the test user |
| `E2E_RESET_SECRET` | Shared secret to authorize the reset-e2e edge function (optional locally, required in CI) |

### Running Locally

```sh
export VITE_SUPABASE_URL="https://your-project.supabase.co"
export VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-key"
export E2E_USER_EMAIL="e2e@example.com"
export E2E_USER_PASSWORD="a-strong-password"
export E2E_RESET_SECRET="your-shared-secret"

npm run test:e2e        # headless
npm run test:e2e:ui     # interactive UI mode
```

### CI (GitHub Actions)

The workflow at `.github/workflows/e2e.yml` runs on every push/PR to `main`. Add the five variables above as **repository secrets** in GitHub → Settings → Secrets and variables → Actions.

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
