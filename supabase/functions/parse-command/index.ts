import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { command } = await req.json();
    if (!command || typeof command !== "string") {
      return new Response(JSON.stringify({ error: "command is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are a command parser for FieldCore Resource Systems, a resource management app. Parse the user's natural language command into a structured JSON intent.

Today's date is ${new Date().toISOString().split("T")[0]}.

Supported intents:
- create_purchase_order: { intent, supplier?, items: [{ name, quantity }], department? }
- create_sales_order: { intent, customer?, items: [{ name, quantity }] }
- show_report: { intent, report_name?, date_range?: { start: string (ISO date), end: string (ISO date), label: string } }
  When the user references a quarter ("Q3 spending", "quarterly revenue for Q1 last year"), parse it into explicit ISO start and end date strings. For example "Q3 2025" becomes start: "2025-07-01", end: "2025-09-30". When the user references a year ("spending last year"), parse it into the full year range.
- reconcile_item: { intent, item_name? }
- record_assembly: { intent, item_name?, quantity? }
- navigate: { intent, destination } (for general navigation like "show purchase orders")

Always return valid JSON only. No markdown, no explanation. If you cannot determine intent, return { "intent": "unknown", "raw": "<original command>" }.`;

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
          { role: "user", content: command },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content ?? "";

    // Try to parse the JSON from the response
    let parsed: Record<string, any>;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { intent: "unknown", raw: command, ai_response: content };
    }

    // --- Enrich with real data from DB ---
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceRoleKey);

    try {
      if (parsed.intent === "create_purchase_order") {
        // Enrich supplier match
        if (parsed.supplier && typeof parsed.supplier === "string") {
          const { data: suppliers } = await sb
            .from("suppliers")
            .select("id, name, avg_lead_time_days")
            .ilike("name", `%${parsed.supplier}%`)
            .limit(1);
          if (suppliers && suppliers.length > 0) {
            parsed.supplier_match = {
              id: suppliers[0].id,
              name: suppliers[0].name,
              avg_lead_time_days: suppliers[0].avg_lead_time_days,
            };
          }
        }

        // Enrich item matches
        if (parsed.items && Array.isArray(parsed.items)) {
          const itemMatches: any[] = [];
          const unmatchedItems: any[] = [];
          for (const item of parsed.items) {
            if (!item.name) continue;
            const { data: items } = await sb
              .from("inventory_items")
              .select("id, name, sku, avg_unit_cost, default_unit_cost")
              .ilike("name", `%${item.name}%`)
              .limit(1);
            if (items && items.length > 0) {
              itemMatches.push({
                parsed_name: item.name,
                id: items[0].id,
                name: items[0].name,
                sku: items[0].sku,
                avg_unit_cost: items[0].avg_unit_cost,
                default_unit_cost: items[0].default_unit_cost,
              });
            } else {
              // No exact match — find closest candidates for the user to pick from
              const { data: candidates } = await sb
                .from("inventory_items")
                .select("id, name, sku")
                .or(`name.ilike.%${item.name.split(" ")[0]}%`)
                .limit(5);
              unmatchedItems.push({
                parsed_name: item.name,
                quantity: item.quantity || 1,
                candidates: (candidates ?? []).map((c: any) => ({
                  id: c.id,
                  name: c.name,
                  sku: c.sku,
                })),
              });
            }
          }
          if (itemMatches.length > 0) {
            parsed.item_matches = itemMatches;
          }
          if (unmatchedItems.length > 0) {
            parsed.unmatched_items = unmatchedItems;
          }
        }
      }

      if (parsed.intent === "create_sales_order") {
        if (parsed.items && Array.isArray(parsed.items)) {
          const itemMatches: any[] = [];
          for (const item of parsed.items) {
            if (!item.name) continue;
            const { data: items } = await sb
              .from("inventory_items")
              .select("id, name")
              .eq("item_type", "resale")
              .ilike("name", `%${item.name}%`)
              .limit(1);
            if (items && items.length > 0) {
              const matchedId = items[0].id;
              // Get on-hand quantity
              const { data: movements } = await sb
                .from("inventory_movements")
                .select("quantity")
                .eq("item_id", matchedId);
              const onHand = (movements ?? []).reduce((s: number, m: any) => s + m.quantity, 0);
              itemMatches.push({
                parsed_name: item.name,
                id: matchedId,
                name: items[0].name,
                on_hand: onHand,
              });
            }
          }
          if (itemMatches.length > 0) {
            parsed.item_matches = itemMatches;
          }
        }
      }
    } catch (enrichErr) {
      console.error("Enrichment error (non-fatal):", enrichErr);
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("parse-command error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
