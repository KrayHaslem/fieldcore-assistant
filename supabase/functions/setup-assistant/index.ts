import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, currentStep, answers } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const answersSnapshot = JSON.stringify(answers ?? {});

    const systemPrompt = `You are the FieldCore organization setup assistant. You are helping a new admin configure their organization through a 6-step wizard.

The 6 setup steps are:
1. What industry is your business in?
2. What types of items does the business purchase? (resale, internal use, manufacturing input, consumables)
3. Do purchases require approval? If yes, at what dollar threshold and by which role?
4. Does the organization have multiple departments with separate approvers?
5. Does the organization track inventory for resale or manufacture finished goods? Does it have a sales team?
6. Data sharing policy acknowledgment.

The admin is currently on step ${currentStep ?? "unknown"}.

Answers collected so far: ${answersSnapshot}

Your role:
- Give helpful, concise guidance relevant to the current step.
- Answer questions about setup options, terminology, and best practices.
- When the user describes their organization, help them understand which options best fit.
- When the current step is 0 (initial analysis), ALWAYS include a RECOMMENDATIONS block extracting everything you can from the user's description. Even partial information should be returned.
- When on later steps, include a RECOMMENDATIONS block when all key answers are collected (typically after step 5 or when the user asks for recommendations).
- The RECOMMENDATIONS block must appear on its own line using exactly this format:
RECOMMENDATIONS:{"industry":"Construction","suggested_departments":["Dept1"],"approval_rules":[{"min_amount":500,"max_amount":null,"required_role":"admin"}],"inventory_types_to_enable":["resale"],"suggested_roles":["admin","procurement"],"tracks_inventory":true,"has_sales_team":false,"notes":"Brief explanation"}
- The recommendations JSON must use these exact field names. Omit fields you cannot determine from the conversation.
- Never invent financial data. Base all suggestions only on what the admin has told you.
- Be concise and practical. Avoid lengthy explanations unless asked.
- Today's date is ${new Date().toISOString().split("T")[0]}.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
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

    let recommendations: Record<string, unknown> | null = null;
    let reply = content;

    const recsMatch = content.match(/RECOMMENDATIONS:\s*(\{[\s\S]*?\})\s*$/m);
    if (recsMatch) {
      try {
        recommendations = JSON.parse(recsMatch[1]);
        reply = content.replace(/RECOMMENDATIONS:\s*\{[\s\S]*?\}\s*$/m, "").trim();
      } catch {
        // parse failed, treat as conversational
      }
    }

    return new Response(JSON.stringify({ reply, recommendations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("setup-assistant error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
