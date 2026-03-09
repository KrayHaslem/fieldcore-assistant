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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, reportDescription } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return jsonResp({ error: "messages array is required" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are a FieldCore report SQL assistant. You help users write PostgreSQL SELECT queries for custom reports.

${SCHEMA_SUMMARY}

CRITICAL RULES — FOLLOW EVERY TIME:
1. EVERY query MUST include WHERE organization_id = :org_id on the primary table being queried. For JOINs, always ensure the main table or a joined table filters by organization_id = :org_id. NEVER write a query without :org_id filtering. This is a multi-tenant system and violating this rule leaks data between organizations.
2. Use :start_date and :end_date as date range placeholders where appropriate (e.g. WHERE created_at >= :start_date AND created_at <= :end_date).
3. Write PostgreSQL-compatible SQL only.
4. NEVER use subqueries that access data without organization_id = :org_id filtering.
5. NEVER use UNION, INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, or any DDL/DML. Only SELECT queries.
6. Do NOT include a semicolon at the end of the query.
7. Do NOT wrap the query in markdown code fences.

WORKFLOW:
- If the user's request is unclear, ask clarifying questions about what data they want, what columns, what filters, etc.
- When you're ready to provide a final SQL query, respond with ONLY the SQL query (starting with SELECT, or WITH for CTEs) and nothing else — no explanation, no markdown, no semicolons.
- During conversation you may explain your approach before writing SQL.

${reportDescription ? `The user described this report: "${reportDescription}"` : ""}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return jsonResp({ error: "Rate limit exceeded, try again shortly." }, 429);
      if (status === 402) return jsonResp({ error: "AI credits exhausted." }, 402);
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content ?? "";

    // Extract SQL if the response is a pure SQL statement
    const trimmed = content.trim();
    let sql: string | null = null;
    if (trimmed.toUpperCase().startsWith("SELECT")) {
      // It's a SQL query
      sql = trimmed.replace(/;$/, "");
    }

    return jsonResp({ reply: content, sql });
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
