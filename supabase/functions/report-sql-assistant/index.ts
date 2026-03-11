import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SCHEMA_SUMMARY = `Available tables and columns (PostgreSQL):

- organizations(id UUID, name TEXT)
- inventory_items(id UUID, organization_id UUID, name TEXT, sku TEXT, item_type TEXT ['resale','manufacturing_input','internal_use','consumable'], default_unit_cost NUMERIC, avg_unit_cost NUMERIC, reorder_point INT)
- inventory_movements(id UUID, organization_id UUID, item_id UUID, movement_type TEXT ['purchase','sale','adjustment','reconciliation','consumption','received','assembled'], quantity INT, source_type TEXT, source_id UUID, created_at TIMESTAMPTZ)
- purchase_orders(id UUID, organization_id UUID, supplier_id UUID, department_id UUID, status TEXT ['draft','submitted','approved','ordered','partially_received','received','closed'], total_amount NUMERIC, created_at TIMESTAMPTZ, ordered_at TIMESTAMPTZ, received_at TIMESTAMPTZ, created_by UUID, po_number TEXT)
- purchase_order_items(id UUID, organization_id UUID, purchase_order_id UUID, item_id UUID, item_type TEXT, quantity INT, quantity_received INT, unit_cost NUMERIC)
- sales_orders(id UUID, organization_id UUID, created_by UUID, customer_name TEXT, status TEXT ['quote','order','fulfilled','invoiced','paid','closed'], total_amount NUMERIC, created_at TIMESTAMPTZ, so_number TEXT)
- sales_order_items(id UUID, organization_id UUID, sales_order_id UUID, item_id UUID, quantity INT, unit_price NUMERIC, cost_per_unit NUMERIC)
- suppliers(id UUID, organization_id UUID, name TEXT, avg_lead_time_days INT, contact_name TEXT, contact_email TEXT)
- departments(id UUID, organization_id UUID, name TEXT)
- reconciliations(id UUID, organization_id UUID, item_id UUID, expected_quantity INT, actual_quantity INT, variance INT, created_at TIMESTAMPTZ, notes TEXT)
- assembly_records(id UUID, organization_id UUID, finished_item_id UUID, quantity_produced INT, created_at TIMESTAMPTZ)
- assembly_record_components(id UUID, assembly_record_id UUID, component_item_id UUID, quantity_consumed INT)
- profiles(id UUID, user_id UUID, organization_id UUID, full_name TEXT, email TEXT, department_id UUID)`;

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

CRITICAL RULES — FOLLOW EVERY TIME:
1. EVERY query MUST include WHERE organization_id = :org_id on the primary table being queried. For JOINs, always ensure the main table or a joined table filters by organization_id = :org_id. NEVER write a query without :org_id filtering. This is a multi-tenant system and violating this rule leaks data between organizations.
2. Use :start_date and :end_date as date range placeholders where appropriate (e.g. WHERE created_at >= :start_date AND created_at <= :end_date).
3. Write PostgreSQL-compatible SQL only.
4. NEVER use subqueries that access data without organization_id = :org_id filtering.
5. NEVER use UNION, INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, or any DDL/DML. Only SELECT queries.
6. Do NOT include a semicolon at the end of the query.
7. Do NOT wrap the query in markdown code fences (no \`\`\`sql or \`\`\`). Output raw SQL only when providing a final query.
8. For date arithmetic, use direct subtraction: (CURRENT_DATE - some_timestamp::DATE) returns an integer number of days in PostgreSQL. Do NOT use EXTRACT(DAY FROM ...) on date subtraction results — it does not work as expected because date minus date returns an integer, not an interval.
9. When calculating "days since" a date, use: (CURRENT_DATE - column_name::DATE) AS days_since_xxx

WORKFLOW:
- If the user's request is unclear, ask clarifying questions about what data they want, what columns, what filters, etc.
- When you're ready to provide a final SQL query, respond with ONLY the SQL query (starting with SELECT, or WITH for CTEs) and nothing else — no explanation, no markdown, no semicolons.
- During conversation you may explain your approach before writing SQL.

${reportDescription ? `The user described this report: "${reportDescription}"` : ""}`;

    const templatePrompt = `You are a FieldCore report template assistant. You help users create complete report templates by suggesting all template fields: name, description, access level, chart type, date filtering support, and the SQL query.

${SCHEMA_SUMMARY}

You have a tool called update_template_fields. Use it to set template fields when you can determine them from the conversation. You can call it multiple times as the conversation progresses.

Guidelines for each field:
- name: Short descriptive title (e.g. "Monthly Spending by Department")
- description: One sentence explaining what the report shows
- access_level: Who should see this report? "admin" for sensitive data, "finance" for financial data, "employee" for general visibility
- chart_type: "table" for detailed data, "bar" for comparisons, "line" for trends over time
- supports_date_range: true if the report benefits from date filtering, false for point-in-time snapshots
- sql_query: PostgreSQL SELECT query following these CRITICAL RULES:
  1. MUST include WHERE organization_id = :org_id
  2. Use :start_date and :end_date as date range placeholders where appropriate
  3. PostgreSQL-compatible SQL only
  4. No semicolons, no markdown code fences
  5. Only SELECT queries — no DDL/DML
  6. For date arithmetic use direct subtraction: (CURRENT_DATE - column::DATE)

WORKFLOW:
- Analyze the user's description and call update_template_fields with all fields you can determine
- If the request is ambiguous, ask clarifying questions BEFORE calling the tool
- You may call the tool with partial fields and fill in more later
- Always include a conversational reply explaining what you set and why

${reportDescription ? `The user described this report: "${reportDescription}"` : ""}`;

    const body: any = {
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: isTemplateMode ? templatePrompt : sqlOnlyPrompt },
        ...messages,
      ],
    };

    if (isTemplateMode) {
      body.tools = TEMPLATE_TOOLS;
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
