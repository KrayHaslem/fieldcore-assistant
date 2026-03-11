

## Plan: Report Template Assistant — Side Panel + Command Center Integration

### Summary

Transform the inline `ReportSqlAssistant` chat into a side panel (like `ReportAssistantPanel` and `FormAssistantPanel`), expand it to update all template fields (name, description, access level, chart type) not just SQL, and wire it into the Command Center via a new `create_report_template` intent.

### 1. New Component: `TemplateAssistantPanel`

**Create `src/components/TemplateAssistantPanel.tsx`**

A side panel component matching the `ReportAssistantPanel` / `FormAssistantPanel` layout pattern:
- Fixed-width panel on the right side (`w-80 shrink-0 border-l`)
- Chat interface with message history
- Calls an updated edge function that returns structured field updates
- Props: `onFieldsUpdate(fields)` callback to push name, description, access_level, chart_type, supports_date_range, and sql_query changes back to the parent form; `onClose`; optional `initialMessage` for command center integration
- A toggle button (Bot icon) in the create/edit form header opens/closes the panel

### 2. Update Edge Function: `report-sql-assistant`

**Edit `supabase/functions/report-sql-assistant/index.ts`**

Expand the system prompt and use tool calling to return structured output:
- Add a `update_template_fields` tool definition with parameters: `name`, `description`, `access_level` (enum of roles), `chart_type` (table/bar/line), `supports_date_range` (boolean), `sql_query`
- All fields are optional — the AI only returns fields it can determine from context
- Keep the existing SQL-only extraction as a fallback for backward compatibility
- Update the system prompt to instruct the AI it can also suggest template metadata (name, description, chart type, access level) in addition to SQL

### 3. Update `SettingsPage.tsx` — Side Panel Layout

**Edit `src/pages/SettingsPage.tsx`**

- Remove the inline `<ReportSqlAssistant>` from both create and edit forms
- Add a `showTemplateAssistant` state boolean
- Add a Bot icon button in both create/edit form headers to toggle the panel
- Wrap the form + panel in a `flex` container so the panel appears to the right (same pattern as Reports page)
- The `onFieldsUpdate` callback merges returned fields into `rtNewForm` or `rtEditForm` state, showing a toast listing which fields were updated
- Keep the SQL textarea in the form (manual editing still possible), but remove the embedded chat

### 4. Command Center Integration

**Edit `supabase/functions/parse-command/index.ts`**
- Add a new intent: `create_report_template: { intent, description?, report_name? }`
- Add to the system prompt's supported intents list

**Edit `src/pages/Dashboard.tsx`**
- Add a handler for `intent === "create_report_template"` that navigates to `/settings?tab=report-templates` with state `{ prefill: data, commandText: command.trim() }`

**Edit `src/pages/SettingsPage.tsx`**
- Read `location.state?.prefill` when the report-templates tab is active
- If prefill has intent `create_report_template`, auto-open the Organization Templates sub-tab, open the new template form (`rtNewOpen = true`), open the `TemplateAssistantPanel`, and pass the command text as `initialMessage`

### 5. Files Changed

| File | Action |
|------|--------|
| `src/components/TemplateAssistantPanel.tsx` | Create (new side panel component) |
| `supabase/functions/report-sql-assistant/index.ts` | Edit (add tool calling for structured fields) |
| `src/pages/SettingsPage.tsx` | Edit (replace inline assistant with side panel, add command center prefill handling) |
| `supabase/functions/parse-command/index.ts` | Edit (add `create_report_template` intent) |
| `src/pages/Dashboard.tsx` | Edit (route new intent to settings page) |

