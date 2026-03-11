

## Plan: Report Search Filters, Auto-open Assistant, and AI Search Pre-fill

This plan covers three connected features: (1) auto-opening the Report Assistant with context when navigating from Command Center, (2) adding search/filter to all list-based reports plus redesigning Purchase History by Item, and (3) teaching the AI assistants to pass search qualifiers.

---

### 1. Auto-open Report Assistant from Command Center navigation

**Files:** `src/pages/Reports.tsx`

- In the existing `useEffect` that reads `location.state`, when `state?.prefill` or `state?.commandText` exists, automatically set `showAssistant = true`
- Pass an `initialMessage` prop to `ReportAssistantPanel` containing the original command text (e.g., "Show me spending on welding rods last quarter")
- In `ReportAssistantPanel`, accept `initialMessage?: string` and if provided, prepend it as the first user message and auto-send on mount

**Files:** `src/components/ReportAssistantPanel.tsx`
- Add `initialMessage` prop
- On mount, if `initialMessage` is set, auto-trigger `handleSend` with that text so the assistant immediately responds with context

**Files:** `src/pages/Dashboard.tsx`
- When navigating to `/reports` for `show_report`, also pass `commandText: command.trim()` in the state (same pattern as purchase orders)

---

### 2. Add search/filter to list-based reports

**Files:** `src/pages/Reports.tsx`

Add a `searchFilter` state (`string`). For each list-based report, filter the displayed rows client-side by matching the search term against the primary text column(s):

| Report | Filter columns |
|---|---|
| Sales by Item | item name |
| Margin by Item | item name |
| Sales by Salesperson | salesperson name |
| Assembly History | finished item name |
| Inventory Loss Summary | item name |
| Recommended Stock Levels | item name, SKU, supplier |
| Inventory Performance by Item | item name |
| Reconciliation History | item name |
| Inventory Valuation | item name, SKU |
| Pending Approvals | PO #, supplier, department |
| Spending by Supplier | supplier name |

Add a search input above each report's table (below the date picker area). Reset `searchFilter` when `selectedKey` changes.

---

### 3. Redesign Purchase History by Item

**Files:** `src/pages/Reports.tsx`

Replace the current "Select an item above" placeholder with a browsable item table:
- When no item is selected, show a searchable list of all inventory items (name, SKU) in a compact table
- Move the ComboBox search field to be above this table as a filter (not in the header card)
- Title: "Select an item to view its purchase history"
- Clicking a row selects the item and loads the purchase history
- The search input filters the item list in real-time
- Fetch all inventory items via a query when `purchase_history_item` is selected

---

### 4. AI search qualifier pre-fill

**Files:** `supabase/functions/parse-command/index.ts`
- Update the `show_report` intent in the system prompt to include an optional `search_term` field for qualifiers (e.g., "Show sales by item for welding rods" → `search_term: "welding rods"`)

**Files:** `supabase/functions/report-assistant/index.ts`
- Update the action response format to include optional `search_term` field in `select_report` actions

**Files:** `src/pages/Reports.tsx`
- In the `useEffect` reading `location.state`, if `state?.prefill?.search_term` exists, set `searchFilter` to that value
- In `handleAssistantSelectReport`, accept and apply an optional `search_term` parameter
- For `purchase_history_item`, if a `search_term` is provided, auto-search items and select the first match

**Files:** `src/components/ReportAssistantPanel.tsx`
- Pass `search_term` from the action to `onSelectReport`

---

### Technical Notes

- All search filtering is client-side using `.toLowerCase().includes()` on already-fetched data — no new DB queries needed
- The `searchFilter` state resets on report change to avoid stale filters
- The Purchase History item list reuses the existing `inventory_items` query pattern
- The AI prompt changes are additive — existing behavior is preserved when `search_term` is not provided

