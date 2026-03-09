import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { template_id, start_date, end_date, user_id, inline_sql, inline_access_level } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Resolve the user's org_id
    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user_id)
      .single();
    if (profileErr || !profile) {
      return jsonResp({ error: "User profile not found." }, 403);
    }
    const orgId = profile.organization_id;

    let sqlQuery: string;
    let accessLevel: string;

    if (inline_sql) {
      // "Test Query" mode — use provided SQL directly, no template lookup
      sqlQuery = inline_sql;
      accessLevel = inline_access_level || "admin";
    } else {
      if (!template_id) return jsonResp({ error: "template_id is required." }, 400);

      // Fetch template
      const { data: template, error: tplErr } = await admin
        .from("report_templates")
        .select("*")
        .eq("id", template_id)
        .single();
      if (tplErr || !template) {
        return jsonResp({ error: "Template not found." }, 404);
      }

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
    const hasAccess = roles.some((r: string) => allowedRoles.includes(r));
    if (!hasAccess) {
      return jsonResp({ error: "You do not have permission to run this report." }, 403);
    }

    // Check for placeholder SQL
    if (!sqlQuery || sqlQuery.trim() === "" || sqlQuery.trim() === "SELECT 1") {
      return jsonResp({ error: "This template has no query configured." }, 400);
    }

    // Replace placeholders — always inject user's org_id for security
    let execSql = sqlQuery
      .replace(/:org_id/g, `'${orgId}'`)
      .replace(/:start_date/g, `'${start_date || "1970-01-01T00:00:00Z"}'`)
      .replace(/:end_date/g, `'${end_date || "2099-12-31T23:59:59Z"}'`);

    // Execute query using postgres via admin client rpc
    // We use a raw SQL approach via the REST API
    const pgResp = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        "Content-Type": "application/json",
      },
    });
    // The above won't work for arbitrary SQL. Use the pg connection directly.
    // We'll use the Supabase SQL endpoint instead.

    const sqlResp = await fetch(`${supabaseUrl}/pg`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: execSql }),
    });

    // Actually, Supabase doesn't have a /pg endpoint. Let's use the database URL directly.
    // We need to use Deno's postgres client.

    // Use the SUPABASE_DB_URL secret
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) {
      return jsonResp({ error: "Database connection not configured." }, 500);
    }

    // Dynamic import of postgres
    const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.4/mod.js");
    const sql = postgres(dbUrl, { max: 1 });

    try {
      const result = await sql.unsafe(execSql);
      const rows = Array.from(result);
      const columns = rows.length > 0 ? Object.keys(rows[0] as Record<string, unknown>) : [];

      await sql.end();

      return jsonResp({ columns, rows });
    } catch (sqlError: any) {
      await sql.end();
      return jsonResp({ error: `Query execution failed: ${sqlError.message}` }, 400);
    }
  } catch (error: any) {
    console.error("run-report error:", error);
    return jsonResp({ error: error.message || "Internal error" }, 500);
  }
});

function jsonResp(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
