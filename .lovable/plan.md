

## Plan: Print-Friendly Order Tickets

### Approach
Create a shared `PrintableOrder` component that renders a print-optimized document using `window.print()`. Add a "Print" button to both `PurchaseOrderDetail` and `SalesOrderDetail` pages.

### What gets printed
A clean, formatted ticket including:
- **Company header**: Organization name (from `orgName` in auth context)
- **Order number, date, status**
- **Vendor/Customer info**: For POs, the supplier name/contact/email (already fetched via join). For SOs, the customer name (and customer details if a `customer_id` exists, fetched from `customers` table).
- **Line items table**: Item name, SKU, quantity, unit price, total
- **Grand total**
- **Notes** (if any)

### Implementation Details

**1. Create `src/components/PrintableOrder.tsx`**
- A reusable component that accepts order data, line items, org name, and a `type` prop (`"purchase" | "sales"`)
- Renders a structured document with company logo, header, contact info sections, line items table, and totals
- Hidden on screen, visible only when printing (using CSS `@media print`)

**2. Add print CSS to `src/index.css`**
- `@media print` rules: hide sidebar, header, buttons; show only the printable content
- Clean typography, borders, black-and-white friendly

**3. Update `PurchaseOrderDetail.tsx`**
- Add a `Printer` icon button next to the "Back" button
- On click, call `window.print()` — the print CSS will handle showing only the printable content
- Render `PrintableOrder` with PO data, supplier info, and line items (all already fetched)

**4. Update `SalesOrderDetail.tsx`**
- Fetch customer details from `customers` table when `customer_id` exists (contact name, email, phone, address)
- Add same print button
- Render `PrintableOrder` with SO data, customer info, and line items

No database changes needed. All required data is already available or can be fetched via existing tables.

