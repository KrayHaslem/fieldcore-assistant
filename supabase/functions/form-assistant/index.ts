import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, formContext, commandText } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are a FieldCore form assistant helping a user fill out a ${formContext || "form"}.

The user originally opened this form with the command: "${commandText || "unknown"}"

Today's date is ${new Date().toISOString().split("T")[0]}.

Your role:
- Answer questions about form fields, requirements, and terminology in clear natural language.
- When the user provides additional data to add to the form (like "change supplier to Acme" or "make that 10 units" or "add 5 widgets"), include a JSON block in your response using exactly this format on its own line: INTENT:{"key": "value"}
  The intent JSON should use the same field names as the parse-command function: supplier, department, items (array of {name, quantity}), customer, item_name, quantity, etc.
- You may ONLY suggest changes. Never submit, approve, confirm, or execute any action on behalf of the user.
- All quantities, prices, item names, and supplier names you reference must come from what the user has told you. Never invent data.
- If the user asks a question, answer it helpfully without an INTENT block.
- If the user gives a command to modify the form, respond conversationally AND include the INTENT block.`;

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

    // Extract INTENT block if present
    let intent: Record<string, any> | null = null;
    let reply = content;

    const intentMatch = content.match(/INTENT:\s*(\{[\s\S]*?\})\s*$/m);
    if (intentMatch) {
      try {
        intent = JSON.parse(intentMatch[1]);
        // Remove the INTENT line from the reply
        reply = content.replace(/INTENT:\s*\{[\s\S]*?\}\s*$/m, "").trim();
      } catch {
        // Failed to parse intent JSON, leave as conversational reply
      }
    }

    return new Response(JSON.stringify({ reply, intent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("form-assistant error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
