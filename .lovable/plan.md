

## Plan: Fix SQL Auto-fill, Query Errors, and Improve Custom Report UX

### Issues Identified

1. **SQL not auto-filling the textarea** — The `report-sql-assistant` edge function checks if the response starts with `SELECT`/`WITH`, but the AI often wraps SQL in markdown code fences (` ```sql ... ``` `). When it does, `sql` is returned as `null` and `onSqlChange` is never called.

2. **Test query error** — The AI generated `EXTRACT(DAY FROM (CURRENT_DATE - MAX(im.created_at)::DATE))` which fails because Postgres date subtraction returns an integer, not an interval. The AI's system prompt needs guidance to avoid this pattern.

3. **UX improvements needed** — The "Test Query" button gives raw error messages, results aren't clearly presented as a preview, and there's no feedback when SQL auto-fills.

---

### Changes

#### 1. Fix SQL extraction in `report-sql-assistant` edge function

**File:** `supabase/functions/report-sql-assistant/index.ts`

- After getting the AI response, also check for markdown-fenced SQL blocks (` ```sql ... ``` ` or ` ``` ... ``` `)
- Strip the fences and extract the raw SQL
- This ensures `sql` is populated regardless of whether the AI wraps it in fences

#### 2. Improve the AI system prompt

**File:** `supabase/functions/report-sql-assistant/index.ts`

- Add a rule: "Do NOT use EXTRACT(DAY FROM date_subtraction). Use `(CURRENT_DATE - some_date::DATE)` directly, which returns an integer in PostgreSQL."
- Reinforce "Do NOT wrap the query in markdown code fences" (already there, but the model sometimes ignores it)

#### 3. Improve `ReportSqlAssistant` component UX

**File:** `src/components/ReportSqlAssistant.tsx`

- **Auto-fill feedback**: When the AI returns SQL and fills the textarea, show a brief toast ("SQL query updated by assistant")
- **Better error display**: Parse `run-report` errors and show user-friendly messages instead of raw "Edge Function returned a non-2xx status code"
- **Handle edge function errors properly**: The `supabase.functions.invoke` call returns the error body in `data` when status is 400 (not in `error`), so check `data?.error` first before treating the response as success
- **Clear previous results** when SQL changes to avoid stale previews
- **Preview label**: Change "Test Query" to "Preview Results" to clarify intent

#### 4. Client-side markdown fence stripping as fallback

**File:** `src/components/ReportSqlAssistant.tsx`

- In `handleSend`, if `data?.sql` is null but the reply contains a SQL code block, extract it client-side and call `onSqlChange` — a defense-in-depth approach in case the edge function extraction misses it

