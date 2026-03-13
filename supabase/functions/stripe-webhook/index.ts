import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    logStep("ERROR", { message: "STRIPE_SECRET_KEY is not set" });
    return new Response("Server misconfigured", { status: 500 });
  }

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    logStep("ERROR", { message: "STRIPE_WEBHOOK_SECRET is not set" });
    return new Response("Server misconfigured", { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    logStep("ERROR", { message: "No stripe-signature header" });
    return new Response("No signature", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logStep("Signature verification failed", { message: msg });
    return new Response(`Webhook signature verification failed: ${msg}`, { status: 400 });
  }

  logStep("Event received", { type: event.type, id: event.id });

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  // Handle relevant subscription events
  const relevantEvents = [
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "customer.subscription.paused",
    "customer.subscription.resumed",
  ];

  if (!relevantEvents.includes(event.type)) {
    logStep("Ignoring event type", { type: event.type });
    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  }

  try {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;

    // Get customer email from Stripe
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted || !customer.email) {
      logStep("Customer deleted or no email", { customerId });
      return new Response(JSON.stringify({ received: true }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    const email = customer.email;
    logStep("Customer email resolved", { email, customerId });

    // Determine if the subscription is active
    const isActive = subscription.status === "active" || subscription.status === "trialing";
    logStep("Subscription status", { status: subscription.status, isActive });

    // Find all profiles with this email and update their orgs
    const { data: profiles, error: profileError } = await supabaseClient
      .from("profiles")
      .select("organization_id")
      .eq("email", email);

    if (profileError) {
      logStep("ERROR finding profiles", { message: profileError.message });
      return new Response("Error finding profiles", { status: 500 });
    }

    if (!profiles || profiles.length === 0) {
      logStep("No profiles found for email", { email });
      return new Response(JSON.stringify({ received: true }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Update subscription_active for each org
    const orgIds = [...new Set(profiles.map((p) => p.organization_id))];
    logStep("Updating orgs", { orgIds, isActive });

    for (const orgId of orgIds) {
      const { error: updateError } = await supabaseClient
        .from("organizations")
        .update({ subscription_active: isActive })
        .eq("id", orgId);

      if (updateError) {
        logStep("ERROR updating org", { orgId, message: updateError.message });
      } else {
        logStep("Org updated", { orgId, subscription_active: isActive });
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR processing event", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
