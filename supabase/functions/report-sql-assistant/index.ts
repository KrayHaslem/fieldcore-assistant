import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SCHEMA_SUMMARY = `Available tables and columns (PostgreSQL):

- organizations(id UUID, name TEXT)
- inventory_items(id UUID, organization_id UUID, name TEXT, sku TEXT, item_type inventory_type, default_unit_cost NUMERIC, avg_unit_cost NUMERIC, reorder_point INT, description TEXT, preferred_supplier_id UUID)
- inventory_movements(id UUID, organization_id UUID, item_id UUID, movement_type movement_type, quantity INT, source_type source_type, source_id UUID, created_at TIMESTAMPTZ, notes TEXT)
- purchase_orders(id UUID, organization_id UUID, supplier_id UUID, department_id UUID, status po_status, total_amount NUMERIC, created_at TIMESTAMPTZ, ordered_at TIMESTAMPTZ, received_at TIMESTAMPTZ, created_by UUID, po_number TEXT)
- purchase_order_items(id UUID, organization_id UUID, purchase_order_id UUID, item_id UUID, item_type inventory_type, quantity INT, quantity_received INT, unit_cost NUMERIC)
- sales_orders(id UUID, organization_id UUID, created_by UUID, customer_name TEXT, status so_status, total_amount NUMERIC, created_at TIMESTAMPTZ, so_number TEXT)
- sales_order_items(id UUID, organization_id UUID, sales_order_id UUID, item_id UUID, quantity INT, unit_price NUMERIC, cost_per_unit NUMERIC)
- suppliers(id UUID, organization_id UUID, name TEXT, avg_lead_time_days INT, contact_name TEXT, contact_email TEXT)
- departments(id UUID, organization_id UUID, name TEXT)
- reconciliations(id UUID, organization_id UUID, item_id UUID, expected_quantity INT, actual_quantity INT, variance INT, created_at TIMESTAMPTZ, notes TEXT)
- assembly_records(id UUID, organization_id UUID, finished_item_id UUID, quantity_produced INT, created_at TIMESTAMPTZ)
- assembly_record_components(id UUID, assembly_record_id UUID, component_item_id UUID, quantity_consumed INT)
- profiles(id UUID, user_id UUID, organization_id UUID, full_name TEXT, email TEXT, department_id UUID)

ENUM VALUES — use these EXACT strings (any other value will cause a runtime error):
- inventory_type: 'resale', 'manufacturing_input', 'internal_use', 'consumable'
- movement_type: 'purchase', 'sale', 'adjustment', 'reconciliation', 'consumption', 'received', 'assembled'  (NOTE: it is 'assembled' NOT 'assembly')
- source_type: 'purchase_order', 'sales_order', 'reconciliation', 'assembly_record', 'manual'
- po_status: 'draft', 'submitted', 'approved', 'ordered', 'partially_received', 'received', 'closed'
- so_status: 'quote', 'order', 'fulfilled', 'invoiced', 'paid', 'closed'`;

const EXAMPLE_REPORTS = `
REFERENCE EXAMPLES — Study these existing system reports to match their quality, style, and level of detail:

EXAMPLE 1 — Inventory Valuation (table, access: procurement):
SELECT ii.name, ii.sku, ii.item_type,
  COALESCE(SUM(im.quantity), 0) AS on_hand,
  ii.default_unit_cost AS unit_cost,
  COALESCE(SUM(im.quantity), 0) * COALESCE(ii.default_unit_cost, 0) AS total_value
FROM inventory_items ii
LEFT JOIN inventory_movements im ON im.item_id = ii.id
WHERE ii.organization_id = :org_id
GROUP BY ii.id, ii.name, ii.sku, ii.item_type, ii.default_unit_cost
ORDER BY ii.item_type, ii.name

EXAMPLE 2 — Spending by Supplier (bar, access: procurement):
SELECT s.name AS supplier, SUM(po.total_amount) AS total_spent
FROM purchase_orders po
JOIN suppliers s ON s.id = po.supplier_id
WHERE po.organization_id = :org_id AND po.status != 'draft'
  AND po.created_at >= :start_date AND po.created_at <= :end_date
GROUP BY s.name ORDER BY total_spent DESC

EXAMPLE 3 — Margin by Item (table, access: finance):
SELECT ii.name AS item_name,
  SUM(soi.quantity)::BIGINT AS units_sold,
  SUM(soi.quantity * soi.unit_price) AS revenue,
  SUM(soi.quantity * soi.cost_per_unit) AS cogs,
  SUM(soi.quantity * soi.unit_price) - SUM(soi.quantity * soi.cost_per_unit) AS gross_margin,
  CASE WHEN SUM(soi.quantity * soi.unit_price) > 0
    THEN ((SUM(soi.quantity * soi.unit_price) - SUM(soi.quantity * soi.cost_per_unit)) / SUM(soi.quantity * soi.unit_price)) * 100
    ELSE 0 END AS margin_pct
FROM sales_order_items soi
JOIN sales_orders so ON so.id = soi.sales_order_id
JOIN inventory_items ii ON ii.id = soi.item_id
WHERE so.organization_id = :org_id
  AND so.status IN ('fulfilled', 'invoiced', 'paid', 'closed')
  AND so.created_at >= :start_date AND so.created_at <= :end_date
GROUP BY ii.name ORDER BY revenue DESC

EXAMPLE 4 — Inventory Loss Summary (table, access: procurement):
SELECT ii.name AS item_name,
  SUM(ABS(r.variance)) AS total_units_lost,
  SUM(ABS(r.variance) * COALESCE(ii.default_unit_cost, 0)) AS estimated_value_lost
FROM reconciliations r
JOIN inventory_items ii ON ii.id = r.item_id
WHERE r.organization_id = :org_id AND r.variance < 0
  AND r.created_at >= :start_date AND r.created_at <= :end_date
GROUP BY ii.name, ii.default_unit_cost
ORDER BY estimated_value_lost DESC

KEY PATTERNS to follow:
- Use descriptive column aliases (item_name, total_spent, units_sold, etc.)
- Include multiple useful columns — not just 2-3 sparse columns
- Add calculated/derived columns when helpful (percentages, totals, costs)
- Use COALESCE for nullable numeric fields
- Use LEFT JOIN when items might have no related records
- Cast counts with ::BIGINT when needed
- Order results meaningfully (DESC by important metric)
`;

/**
 * Extract raw SQL from a response that may contain markdown code fences.
 */
function extractSqlFromFences(text: string): string | null {
  const fenceRegex = /```(?:sql)?\s*\n?([\s\S]*?)```/i;
  const match = text.match(fenceRegex);
  if (match) {
    const inner = match[1].trim().replace(/;$/, "");
    const upper = inner.toUpperCase();
    if (upper.startsWith("SELECT") || upper.startsWith("WITH")) {
      return inner;
    }
  }
  return null;
}

// ── SQL Quality Guardrails ──────────────────────────────────────────────
// Validates AI-generated SQL and returns a list of issues found.
// Some issues are auto-fixable; others require the AI to regenerate.

interface SqlIssue {
  severity: "error" | "warning";
  message: string;
  autoFixable: boolean;
}

function validateGeneratedSql(sql: string): { issues: SqlIssue[]; fixedSql: string } {
  const issues: SqlIssue[] = [];
  let fixedSql = sql;
  const upper = sql.toUpperCase();

  // 1. Must contain :org_id filtering
  if (!sql.includes(":org_id")) {
    issues.push({
      severity: "error",
      message: "Missing :org_id filter — multi-tenant data leak risk.",
      autoFixable: false,
    });
  }

  // 2. EXTRACT(DAY FROM ...) on date subtraction — the #1 offender
  const extractDayPattern = /EXTRACT\s*\(\s*DAY\s+FROM\s+[^)]*(?:NOW\(\)|CURRENT_DATE|CURRENT_TIMESTAMP)[^)]*-[^)]*\)/gi;
  if (extractDayPattern.test(fixedSql)) {
    issues.push({
      severity: "error",
      message: "Uses EXTRACT(DAY FROM date_subtraction) which doesn't work in PostgreSQL. Auto-fixing to direct subtraction.",
      autoFixable: true,
    });
    // Auto-fix: replace EXTRACT(DAY FROM (NOW() - col)) with (CURRENT_DATE - col::DATE)
    fixedSql = fixedSql.replace(
      /EXTRACT\s*\(\s*DAY\s+FROM\s+\(\s*(?:NOW\(\)|CURRENT_DATE|CURRENT_TIMESTAMP)\s*-\s*([\w.]+(?:\s*::\s*\w+)?)\s*\)\s*\)/gi,
      "(CURRENT_DATE - $1::DATE)"
    );
    // Also handle without parens
    fixedSql = fixedSql.replace(
      /EXTRACT\s*\(\s*DAY\s+FROM\s+(?:NOW\(\)|CURRENT_DATE|CURRENT_TIMESTAMP)\s*-\s*([\w.]+(?:\s*::\s*\w+)?)\s*\)/gi,
      "(CURRENT_DATE - $1::DATE)"
    );
  }

  // 3. Wrong enum values
  const wrongEnums: [RegExp, string][] = [
    [/'assembly'/gi, "Use 'assembled' not 'assembly' for movement_type enum."],
  ];
  for (const [pattern, msg] of wrongEnums) {
    if (pattern.test(fixedSql)) {
      issues.push({ severity: "error", message: msg, autoFixable: true });
      fixedSql = fixedSql.replace(/'assembly'/gi, "'assembled'");
    }
  }

  // 4. Trailing semicolons
  if (fixedSql.trim().endsWith(";")) {
    fixedSql = fixedSql.trim().replace(/;$/, "");
    issues.push({ severity: "warning", message: "Removed trailing semicolon.", autoFixable: true });
  }

  // 5. Contains forbidden DDL/DML
  const forbidden = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "TRUNCATE"];
  const normalizedCheck = fixedSql.replace(/\s+/g, " ").toUpperCase();
  for (const kw of forbidden) {
    const regex = new RegExp(`\\b${kw}\\b`);
    if (regex.test(normalizedCheck) && !normalizedCheck.startsWith("SELECT") && !normalizedCheck.startsWith("WITH")) {
      issues.push({ severity: "error", message: `Contains forbidden keyword: ${kw}`, autoFixable: false });
    }
  }

  // 6. Too few columns (less than 3 SELECT expressions) — warning only
  const selectClause = fixedSql.match(/^(?:WITH[\s\S]*?\)\s*)?SELECT\s+([\s\S]*?)\s+FROM\s/i);
  if (selectClause) {
    // Simple comma count (not perfect but catches obvious 1-2 column queries)
    const commaCount = (selectClause[1].match(/,(?![^(]*\))/g) || []).length;
    if (commaCount < 2) {
      issues.push({
        severity: "warning",
        message: "Query selects fewer than 3 columns — consider adding more for a useful report.",
        autoFixable: false,
      });
    }
  }

  return { issues, fixedSql };
}

/** Build a correction prompt from SQL issues for the AI to self-correct. */
function buildCorrectionPrompt(sql: string, issues: SqlIssue[]): string {
  const errorList = issues.map((i) => `- ${i.message}`).join("\n");
  return `The SQL query you generated has the following issues:\n${errorList}\n\nOriginal query:\n${sql}\n\nPlease fix these issues and return ONLY the corrected SQL query. Remember: use (CURRENT_DATE - column::DATE) for day calculations, never EXTRACT(DAY FROM ...). Include at least 4-6 columns with descriptive aliases.`;
}

const TEMPLATE_TOOLS = [
  {
    type: "function",
    function: {
      name: "update_template_fields",
      description: "Update report template fields. Call this when you have determined one or more template fields from the user's description. All parameters are optional — only include fields you can confidently determine.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "A short, descriptive report name (e.g. 'Monthly Spending by Department')" },
          description: { type: "string", description: "A one-sentence description of what the report shows" },
          access_level: { type: "string", enum: ["admin", "procurement", "sales", "finance", "employee"], description: "Minimum role required to view this report" },
          chart_type: { type: "string", enum: ["table", "bar", "line"], description: "How to visualize the data" },
          supports_date_range: { type: "boolean", description: "Whether the report should show date range filters" },
          sql_query: { type: "string", description: "The PostgreSQL SELECT query. Must include WHERE organization_id = :org_id. Use :start_date and :end_date as date placeholders. No semicolons." },
        },
        required: [],
      },
    },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, reportDescription, mode, instruction } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return jsonResp({ error: "messages array is required" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const isTemplateMode = mode === "template";

    const sqlOnlyPrompt = `You are a FieldCore report SQL assistant. You help users write PostgreSQL SELECT queries for custom reports.

${SCHEMA_SUMMARY}

${EXAMPLE_REPORTS}

CRITICAL RULES — FOLLOW EVERY TIME:
1. EVERY query MUST include WHERE organization_id = :org_id on the primary table being queried. For JOINs, always ensure the main table or a joined table filters by organization_id = :org_id. NEVER write a query without :org_id filtering. This is a multi-tenant system and violating this rule leaks data between organizations.
2. Use :start_date and :end_date as date range placeholders where appropriate (e.g. WHERE created_at >= :start_date AND created_at <= :end_date).
3. Write PostgreSQL-compatible SQL only.
4. NEVER use subqueries that access data without organization_id = :org_id filtering.
5. NEVER use UNION, INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, or any DDL/DML. Only SELECT queries.
6. Do NOT include a semicolon at the end of the query.
7. Do NOT wrap the query in markdown code fences (no \`\`\`sql or \`\`\`). Output raw SQL only when providing a final query.
8. CRITICAL DATE ARITHMETIC: Use direct subtraction (CURRENT_DATE - some_timestamp::DATE) which returns an integer number of days. NEVER use EXTRACT(DAY FROM ...) on date subtraction — it does NOT work because date minus date returns an integer, not an interval.
9. When calculating "days since" a date, use: (CURRENT_DATE - column_name::DATE) AS days_since_xxx
10. Study the REFERENCE EXAMPLES above and match their quality — include multiple useful columns, calculated fields, COALESCE for nullables, and meaningful ordering.

WORKFLOW:
- If the user's request is unclear, ask clarifying questions about what data they want, what columns, what filters, etc.
- When you're ready to provide a final SQL query, respond with ONLY the SQL query (starting with SELECT, or WITH for CTEs) and nothing else — no explanation, no markdown, no semicolons.
- During conversation you may explain your approach before writing SQL.

${reportDescription ? `The user described this report: "${reportDescription}"` : ""}`;

    const templatePrompt = `You are a FieldCore report template assistant. You help users create complete report templates by suggesting ALL template fields at once: name, description, access level, chart type, date filtering support, AND the SQL query.

${SCHEMA_SUMMARY}

${EXAMPLE_REPORTS}

You have a tool called update_template_fields. You MUST call it to set template fields.

CRITICAL BEHAVIOR:
- On the FIRST user message, you MUST call update_template_fields with ALL fields including sql_query. Do NOT ask clarifying questions on the first message — make your best judgment and generate everything.
- The user can always refine later. It is much better to provide a complete template that can be tweaked than to ask questions and leave fields empty.
- ALWAYS include sql_query in your tool call. Never call the tool without sql_query.
- If asked to refine or add SQL later, call the tool again with the updated sql_query.
- Study the REFERENCE EXAMPLES above carefully and match their quality, column count, and style.

Guidelines for each field:
- name: Short descriptive title (e.g. "Monthly Spending by Department")
- description: One sentence explaining what the report shows
- access_level: DEFAULT to "employee" (visible to everyone) unless the report contains sensitive financial data (use "finance") or admin-only data (use "admin"). Do NOT pick "procurement" or "sales" unless the user explicitly requests role-restricted access.
- chart_type: "table" for detailed data, "bar" for comparisons, "line" for trends over time
- supports_date_range: true if the report benefits from date filtering, false for point-in-time snapshots
- sql_query: PostgreSQL SELECT query following these CRITICAL RULES:
  1. MUST include WHERE organization_id = :org_id
  2. Use :start_date and :end_date as date range placeholders where appropriate
  3. PostgreSQL-compatible SQL only
  4. No semicolons, no markdown code fences
  5. Only SELECT queries — no DDL/DML
  6. CRITICAL: For date arithmetic use direct subtraction: (CURRENT_DATE - column::DATE) returns an integer. NEVER use EXTRACT(DAY FROM ...) on date subtraction.
  7. Include 4-6+ meaningful columns with descriptive aliases — not just 2-3 sparse columns
  8. Add calculated/derived columns (percentages, costs, totals) when they add value
  9. Use COALESCE for nullable numeric fields
  10. Use LEFT JOIN when items might have no matching records (so they still appear)
  11. Order results by the most meaningful metric DESC

After calling the tool, include a conversational reply explaining what you set and why, and invite the user to refine any fields.

${reportDescription ? `The user described this report: "${reportDescription}"` : ""}
${instruction ? `\nIMPORTANT: ${instruction}` : ""}`;

    const body: any = {
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: isTemplateMode ? templatePrompt : sqlOnlyPrompt },
        ...messages,
      ],
    };

    if (isTemplateMode) {
      body.tools = TEMPLATE_TOOLS;
      // Force tool call to ensure SQL and all fields are always generated
      body.tool_choice = { type: "function", function: { name: "update_template_fields" } };
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return jsonResp({ error: "Rate limit exceeded, try again shortly." }, 429);
      if (status === 402) return jsonResp({ error: "AI credits exhausted." }, 402);
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiResult = await response.json();
    const choice = aiResult.choices?.[0];
    const message = choice?.message;
    const content = message?.content ?? "";

    // Handle tool calls (template mode)
    let fields: Record<string, any> | null = null;
    if (message?.tool_calls && Array.isArray(message.tool_calls)) {
      for (const tc of message.tool_calls) {
        if (tc.function?.name === "update_template_fields") {
          try {
            fields = JSON.parse(tc.function.arguments);
          } catch {
            // ignore parse errors
          }
        }
      }
    }

    // Fallback: extract SQL from content (for sql-only mode or if tool calling didn't fire)
    let sql: string | null = null;
    if (!isTemplateMode || !fields) {
      const trimmed = content.trim();
      const cleanTrimmed = trimmed.replace(/;$/, "");
      if (cleanTrimmed.toUpperCase().startsWith("SELECT") || cleanTrimmed.toUpperCase().startsWith("WITH")) {
        sql = cleanTrimmed;
      } else {
        sql = extractSqlFromFences(trimmed);
      }
    }

    // If we got fields with sql_query, also set sql for backward compat
    if (fields?.sql_query) {
      sql = fields.sql_query;
    }

    return jsonResp({ reply: content, sql, fields: fields || undefined });
  } catch (error: any) {
    console.error("report-sql-assistant error:", error);
    return jsonResp({ error: error.message }, 500);
  }
});

function jsonResp(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
