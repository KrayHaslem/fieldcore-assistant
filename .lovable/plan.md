

## Plan: Customers Module — Settings, Sales Order Integration, and Command Center AI

### What We're Building

1. **Customers table + Settings tab** — A `customers` table mirroring `suppliers`, with a "Customers" tab in Settings for CRUD management (name, contact name, email, phone, address, notes).

2. **Sales Order customer picker** — Replace the free-text "Customer Name" input on CreateSalesOrder with a ComboBox that searches the `customers` table (like the supplier picker on CreatePurchaseOrder). Keep the ability to type a new customer name that doesn't exist yet.

3. **Command Center AI integration** — Enrich the `create_sales_order` intent in `parse-command` with customer fuzzy matching (mirroring supplier matching on PO), and wire up the FormAssistantPanel on CreateSalesOrder with Direct Actions for unmatched customers (Use existing / Create new).

### Technical Details

**1. Database Migration**

Create a `customers` table:
- `id` (uuid, PK, default gen_random_uuid())
- `organization_id` (uuid, NOT NULL)
- `name` (text, NOT NULL)
- `contact_name` (text, nullable)
- `contact_email` (text, nullable)
- `contact_phone` (text, nullable)
- `address` (text, nullable)
- `notes` (text, nullable)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

Standard org-isolation RLS policies (select/insert/update/delete).

Add `customer_id` (uuid, nullable) to `sales_orders` to link orders to customers while keeping `customer_name` for backward compatibility.

Add `updated_at` trigger on customers table.

**2. Settings Page — Customers Tab** (`src/pages/SettingsPage.tsx`)

- Add a "Customers" tab visible to Admin and Sales roles (mirroring Suppliers tab pattern).
- CRUD dialog with fields: name, contact name, email, phone, address, notes.
- Table columns: Name, Contact, Email, Phone, Actions (edit).

**3. CreateSalesOrder — Customer ComboBox** (`src/pages/CreateSalesOrder.tsx`)

- Replace the plain `<Input>` for customer name with a `<ComboBox>` that searches the `customers` table.
- When a customer is selected, set both `customerName` (display) and `customerId` (FK).
- Allow free-text entry for one-off customers (customerId stays null, customer_name is saved as-is).
- On save, include `customer_id` in the sales_orders insert payload.

**4. Parse-Command Enrichment** (`supabase/functions/parse-command/index.ts`)

- In the `create_sales_order` intent block, add customer fuzzy matching against the `customers` table (mirror the supplier matching logic).
- Return `customer_match` or `unmatched_customer` with candidates.

**5. FormAssistantPanel on Sales Orders** (`src/pages/CreateSalesOrder.tsx`)

- Pass `unmatchedCustomer` data to `FormAssistantPanel` (add support for customer Direct Actions similar to supplier Direct Actions).
- Add `DirectAction` types: `use_customer` and `create_customer`.
- Handle these in the parent to set the customer ComboBox and optionally insert a new customer record.

**6. Seed Data** (`supabase/functions/seed-demo/index.ts`)

- Add 5-6 demo customers for the Innovex org to match existing sales order customer names.

### Files Changed

| File | Change |
|------|--------|
| Migration SQL | New `customers` table + RLS + `customer_id` on `sales_orders` |
| `src/pages/SettingsPage.tsx` | Add Customers tab with CRUD |
| `src/pages/CreateSalesOrder.tsx` | ComboBox customer picker, customer_id on save, Direct Actions |
| `src/components/FormAssistantPanel.tsx` | Add `UnmatchedCustomer` type + `use_customer`/`create_customer` Direct Actions |
| `supabase/functions/parse-command/index.ts` | Customer fuzzy matching for `create_sales_order` |
| `supabase/functions/seed-demo/index.ts` | Seed demo customers |

