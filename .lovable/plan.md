

## Plan: Multi-Org Support, User Invitations, and User Deactivation

This is a significant feature set spanning database schema changes, backend logic, and UI updates. Here is the phased plan.

---

### Phase 1: Database Schema Changes

**1a. Add `is_active` column to `profiles` table**
- Add `is_active BOOLEAN NOT NULL DEFAULT true` to `profiles`
- Admins can toggle this to deactivate/reactivate users within their org

**1b. Create `invitations` table**
```text
invitations
├── id (uuid, PK)
├── organization_id (uuid, NOT NULL)
├── email (text, NOT NULL)
├── invited_by (uuid, NOT NULL)
├── token (text, UNIQUE, NOT NULL)
├── roles (app_role[], NOT NULL, default '{employee}')
├── accepted_at (timestamptz, nullable)
├── expires_at (timestamptz, NOT NULL)
├── created_at (timestamptz, default now())
```
- RLS: org-scoped read/write for admins; public SELECT by token for acceptance

**1c. Allow multiple profiles per user (multi-org)**
- Currently `can_insert_profile()` blocks any user who already has a profile. Update this function to allow inserting a profile for a *different* organization (check user_id + organization_id uniqueness instead of just user_id).
- Add a unique constraint on `(user_id, organization_id)` to `profiles`.
- The existing `get_user_org_id()` function returns a single org. It needs to accept or derive a "current org" context. We'll handle this with a new approach (see 1d).

**1d. Track active organization**
- Add `active_organization_id UUID` column to a new `user_preferences` table (or use the existing profile approach).
- Simpler approach: store active org in `localStorage` on the client, and pass it contextually. The `get_user_org_id()` function will remain as-is (returns first profile's org), but the client-side auth context will allow switching.
- **Chosen approach**: Store the active org ID in a lightweight `user_preferences` table:
  ```text
  user_preferences
  ├── user_id (uuid, PK, references auth.users)
  ├── active_organization_id (uuid)
  ├── updated_at (timestamptz)
  ```
- Update `get_user_org_id()` to read from `user_preferences.active_organization_id` first, falling back to the first profile's org.

---

### Phase 2: Backend Functions

**2a. `invite-user` edge function**
- Admin calls this with email, roles, org_id
- Generates a unique token, inserts into `invitations` table
- Sends an email (using the built-in auth email or a simple notification) with a link like `{origin}/auth?invite={token}`
- Token expires after 7 days

**2b. Invitation acceptance flow**
- When a user signs up / logs in with an invite token, the system:
  - Validates the token (not expired, not already accepted)
  - Creates a profile for the user in the invited org
  - Assigns the specified roles
  - Marks the invitation as accepted

**2c. Update `get_user_org_id()` function**
- Check `user_preferences.active_organization_id` first
- Fall back to first profile's org_id if no preference set

---

### Phase 3: Auth Context Changes (`src/lib/auth.tsx`)

- Fetch all profiles for the current user (not just one) to know which orgs they belong to
- Expose `organizations: {id, name}[]` and `switchOrg(orgId)` in the auth context
- `switchOrg` updates `user_preferences.active_organization_id` and re-fetches profile/roles/orgInfo for the selected org
- Add `is_active` check: if the current profile's `is_active` is false, sign out or show a "deactivated" message

---

### Phase 4: UI Changes

**4a. Org switcher in sidebar (`AppSidebar.tsx`)**
- Below the logo/app name, show the current organization name
- If the user belongs to multiple orgs, render a dropdown/select to switch
- On switch, call `switchOrg()` from auth context

**4b. Users & Roles tab enhancements (`SettingsPage.tsx`)**
- Add "Invite User" button that opens a dialog (email + role checkboxes)
- Show `is_active` status badge on each user row
- Add activate/deactivate toggle button per user (admin only, cannot deactivate self)
- Show pending invitations list with ability to revoke

**4c. Invitation acceptance on auth page (`AuthPage.tsx`)**
- Detect `?invite=TOKEN` query param
- After login/signup, automatically accept the invitation and redirect to the new org's dashboard

---

### Phase 5: RLS & Security

- `invitations` table: admins in the org can CRUD; unauthenticated users can SELECT by token (for validation)
- `user_preferences`: users can only read/write their own row
- `profiles` INSERT policy: update `can_insert_profile()` to allow if no profile exists *for that specific org*
- `is_active` enforcement: update RLS on data tables to check `is_active` on the caller's profile, or handle at the application layer by blocking navigation

---

### Implementation Order

1. DB migration: `is_active` on profiles, `invitations` table, `user_preferences` table, updated constraints and functions
2. `invite-user` edge function
3. Auth context updates (multi-org, org switching, is_active check)
4. Sidebar org switcher UI
5. Settings page: invite dialog, active/inactive toggle, pending invitations list
6. Auth page: invitation acceptance flow

