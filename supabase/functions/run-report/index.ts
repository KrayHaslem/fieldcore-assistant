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

const MAX_ROWS = 5000;
const QUERY_TIMEOUT_SECONDS = 15;

/**
 * Validate an ISO date string. Returns the sanitized string or null.
 */
function sanitizeDate(input: string | undefined | null, fallback: string): string {
  if (!input || typeof input !== "string") return fallback;
  // Strict ISO 8601 date/datetime pattern
  const iso = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;
  if (!iso.test(input.trim())) return fallback;
  // Extra safety: try parsing
  const d = new Date(input.trim());
  if (isNaN(d.getTime())) return fallback;
  return d.toISOString();
}

/**
 * Strip SQL comments (both -- and /* *​/) to prevent hiding keywords inside them.
 */
function stripComments(sql: string): string {
  // Remove block comments (non-greedy, handles nested poorly but sufficient for blocklist)
  let result = sql.replace(/\/\*[\s\S]*?\*\//g, " ");
  // Remove line comments
  result = result.replace(/--.*/g, " ");
  return result;
}

/**
 * Validate that SQL is a safe read-only SELECT statement.
 */
function validateSelectOnly(sql: string): string | null {
  const stripped = stripComments(sql);
  // Normalize whitespace
  const normalized = stripped.replace(/\s+/g, " ").trim().toUpperCase();

  // Must start with SELECT or WITH (for CTEs)
  if (!normalized.startsWith("SELECT") && !normalized.startsWith("WITH")) {
    return "Only SELECT queries are allowed.";
  }

  // Forbidden keywords — check against comment-stripped, normalized SQL
  const forbidden = [
    "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE",
    "TRUNCATE", "GRANT", "REVOKE", "EXECUTE", "EXEC",
    "COPY", "CALL", "DO", "SET ", "RESET",
    "LISTEN", "NOTIFY", "VACUUM", "ANALYZE",
    "PREPARE", "DEALLOCATE",
    "CREATE FUNCTION", "CREATE PROCEDURE",
    "PG_SLEEP", "PG_TERMINATE_BACKEND", "PG_CANCEL_BACKEND",
    "LO_IMPORT", "LO_EXPORT",
    "DBLINK", "FILE_FDW",
    "PG_READ_FILE", "PG_READ_BINARY_FILE", "PG_LS_DIR",
    "CURRENT_SETTING", "SET_CONFIG",
  ];

  for (const kw of forbidden) {
    // Word-boundary check to avoid false positives (e.g. "UPDATED_AT")
    const regex = new RegExp(`\\b${kw.replace(/\s+/g, "\\s+")}\\b`);
    if (regex.test(normalized)) {
      return `Forbidden SQL keyword detected: ${kw.trim()}`;
    }
  }

  // No multiple statements (semicolons)
  // Remove string literals first to avoid false positives on semicolons inside strings
  const withoutStrings = normalized.replace(/'[^']*'/g, "''");
  if (withoutStrings.includes(";")) {
    return "Multiple SQL statements are not allowed.";
  }

  return null; // valid
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { template_id, start_date, end_date, user_id, inline_sql, inline_access_level } = await req.json();

    if (!user_id || typeof user_id !== "string") return jsonResp({ error: "user_id is required." }, 400);

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

    // Validate orgId is a proper UUID to prevent injection through it
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(orgId)) {
      return jsonResp({ error: "Invalid organization." }, 403);
    }

    let sqlQuery: string;
    let accessLevel: string;

    if (inline_sql) {
      if (typeof inline_sql !== "string") return jsonResp({ error: "inline_sql must be a string." }, 400);
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

    // Validate SQL safety
    const validationError = validateSelectOnly(trimmedSql);
    if (validationError) {
      return jsonResp({ error: validationError }, 400);
    }

    // Sanitize date inputs strictly
    const safeStartDate = sanitizeDate(start_date, "1970-01-01T00:00:00Z");
    const safeEndDate = sanitizeDate(end_date, "2099-12-31T23:59:59Z");

    // Replace placeholders with validated values
    const execSql = trimmedSql
      .replace(/:org_id/g, `'${orgId}'`)
      .replace(/:start_date/g, `'${safeStartDate}'`)
      .replace(/:end_date/g, `'${safeEndDate}'`);

    const sql = postgres(dbUrl, { max: 1, idle_timeout: 5 });

    try {
      const result = await sql.begin(async (tx: any) => {
        await tx.unsafe(`SET LOCAL statement_timeout = '${QUERY_TIMEOUT_SECONDS}s'`);
        await tx.unsafe("SET LOCAL default_transaction_read_only = on");
        return await tx.unsafe(`SELECT * FROM (${execSql}) AS _report_result LIMIT ${MAX_ROWS + 1}`);
      });

      let rows = Array.from(result as Record<string, unknown>[]);
      let truncated = false;
      if (rows.length > MAX_ROWS) {
        rows = rows.slice(0, MAX_ROWS);
        truncated = true;
      }
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      await sql.end();
      return jsonResp({ columns, rows, truncated, row_count: rows.length });
    } catch (sqlError: any) {
      try { await sql.end(); } catch {}
      const msg = sqlError.message || "Unknown query error";
      // Don't leak internal details — sanitize
      const safeMsg = msg.includes("statement timeout")
        ? "Query timed out. Please simplify your query."
        : msg.includes("read-only")
        ? "Write operations are not allowed in reports."
        : `Query execution failed: ${msg.substring(0, 200)}`;
      return jsonResp({ error: safeMsg }, 400);
    }
  } catch (error: any) {
    console.error("run-report error:", error);
    return jsonResp({ error: "Internal error" }, 500);
  }
});
