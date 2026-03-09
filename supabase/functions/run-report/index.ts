import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResp(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { template_id, start_date, end_date, user_id, inline_sql, inline_access_level } = await req.json();

    if (!user_id) return jsonResp({ error: "user_id is required." }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) return jsonResp({ error: "Database connection not configured." }, 500);

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Resolve user's org_id
    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user_id)
      .single();
    if (profileErr || !profile) return jsonResp({ error: "User profile not found." }, 403);
    const orgId = profile.organization_id;

    let sqlQuery: string;
    let accessLevel: string;

    if (inline_sql) {
      // "Test Query" mode — caller provides SQL directly
      sqlQuery = inline_sql;
      accessLevel = inline_access_level || "admin";
    } else {
      if (!template_id) return jsonResp({ error: "template_id is required." }, 400);

      const { data: template, error: tplErr } = await admin
        .from("report_templates")
        .select("*")
        .eq("id", template_id)
        .single();
      if (tplErr || !template) return jsonResp({ error: "Template not found." }, 404);

      // Verify org access
      if (template.organization_id !== null && template.organization_id !== orgId) {
        return jsonResp({ error: "Access denied." }, 403);
      }

      sqlQuery = template.sql_query;
      accessLevel = template.access_level;
    }

    // Verify role access
    const roleHierarchy: Record<string, string[]> = {
      employee: ["admin", "finance", "procurement", "sales", "employee"],
      sales: ["admin", "finance", "sales"],
      procurement: ["admin", "finance", "procurement"],
      finance: ["admin", "finance"],
      admin: ["admin"],
    };
    const allowedRoles = roleHierarchy[accessLevel] || ["admin"];

    const { data: userRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user_id);
    const roles = (userRoles ?? []).map((r: any) => r.role);
    if (!roles.some((r: string) => allowedRoles.includes(r))) {
      return jsonResp({ error: "You do not have permission to run this report." }, 403);
    }

    // Check for placeholder SQL
    const trimmedSql = sqlQuery?.trim();
    if (!trimmedSql || trimmedSql === "SELECT 1") {
      return jsonResp({ error: "This template has no query configured." }, 400);
    }

    // Validate: only SELECT allowed
    const upper = trimmedSql.toUpperCase();
    if (!upper.startsWith("SELECT")) {
      return jsonResp({ error: "Only SELECT queries are allowed." }, 400);
    }
    const forbidden = ["INSERT ", "UPDATE ", "DELETE ", "DROP ", "ALTER ", "CREATE ", "TRUNCATE ", "GRANT ", "REVOKE "];
    for (const kw of forbidden) {
      if (upper.includes(kw)) {
        return jsonResp({ error: `Forbidden SQL keyword detected: ${kw.trim()}` }, 400);
      }
    }

    // Replace placeholders — ALWAYS inject user's org_id for security
    const execSql = trimmedSql
      .replace(/:org_id/g, `'${orgId}'`)
      .replace(/:start_date/g, `'${start_date || "1970-01-01T00:00:00Z"}'`)
      .replace(/:end_date/g, `'${end_date || "2099-12-31T23:59:59Z"}'`);

    // Execute using postgres
    const sql = postgres(dbUrl, { max: 1, idle_timeout: 5 });

    try {
      const result = await sql.unsafe(execSql);
      const rows = Array.from(result) as Record<string, unknown>[];
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      await sql.end();
      return jsonResp({ columns, rows });
    } catch (sqlError: any) {
      try { await sql.end(); } catch {}
      return jsonResp({ error: `Query execution failed: ${sqlError.message}` }, 400);
    }
  } catch (error: any) {
    console.error("run-report error:", error);
    return jsonResp({ error: error.message || "Internal error" }, 500);
  }
});
