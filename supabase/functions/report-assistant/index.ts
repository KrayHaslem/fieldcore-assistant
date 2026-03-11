import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, available_reports } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return jsonResp({ error: "messages array is required" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const today = new Date().toISOString().split("T")[0];

    const systemPrompt = `You are a report assistant for FieldCore Resource Systems. Help users find the right report and set date ranges. Be concise and helpful.

Today's date is ${today}.

Available reports:
${(available_reports || []).map((r: any) => `- "${r.name}": ${r.description || "No description"} (category: ${r.category || "General"})`).join("\n")}

INSTRUCTIONS:
1. When a user asks about data, recommend the most relevant report from the list above.
2. If the user mentions a time period, parse it into start and end ISO dates.
3. If the request is ambiguous, ask a clarifying question — but keep it short (1-2 sentences).
4. If the user asks for something that doesn't match any available report, explain what's available and suggest the closest match.

RESPONSE FORMAT:
Always respond with valid JSON only. No markdown, no explanation outside the JSON.

{
  "reply": "Your conversational message to the user",
  "action": null | {
    "type": "select_report",
    "report_name": "exact report name from available list",
    "start_date": "ISO date string or null",
    "end_date": "ISO date string or null",
    "search_term": "optional qualifier to filter results (e.g. item name, supplier name) or null"
  }
}

If you're just asking a clarifying question or chatting, set "action" to null.
If the user says something completely unrelated to reports or data, reply helpfully and set "action" to null.`;

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

    // Parse JSON response
    let parsed: any;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // If not valid JSON, treat as plain text reply
      parsed = { reply: content, action: null };
    }

    return jsonResp(parsed);
  } catch (error: any) {
    console.error("report-assistant error:", error);
    return jsonResp({ error: error.message }, 500);
  }
});

function jsonResp(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
