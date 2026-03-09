import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Fixed IDs for the E2E test organization
const E2E_ORG_ID = "00000000-0000-0000-0000-e2e000000001";

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "reset"; // "reset" | "cleanup"
    const email = body.email;
    const password = body.password;
    const fullName = body.full_name ?? "E2E Test User";

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "email and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== WIPE all data in the E2E test org =====
    // Get existing test user IDs
    const { data: existingProfiles } = await sb
      .from("profiles")
      .select("user_id")
      .eq("organization_id", E2E_ORG_ID);
    const existingUserIds = (existingProfiles ?? []).map((p: any) => p.user_id);

    // Delete in dependency order (same as seed-demo)
    await sb.from("bill_of_materials").delete().eq("organization_id", E2E_ORG_ID);
    await sb.from("reconciliations").delete().eq("organization_id", E2E_ORG_ID);
    await sb.from("inventory_movements").delete().eq("organization_id", E2E_ORG_ID);

    // Assembly record components need to be deleted via assembly_record_id
    const { data: assemblyRecords } = await sb
      .from("assembly_records")
      .select("id")
      .eq("organization_id", E2E_ORG_ID);
    const arIds = (assemblyRecords ?? []).map((r: any) => r.id);
    if (arIds.length > 0) {
      await sb.from("assembly_record_components").delete().in("assembly_record_id", arIds);
    }
    await sb.from("assembly_records").delete().eq("organization_id", E2E_ORG_ID);

    await sb.from("sales_order_items").delete().eq("organization_id", E2E_ORG_ID);
    await sb.from("sales_orders").delete().eq("organization_id", E2E_ORG_ID);
    await sb.from("purchase_order_items").delete().eq("organization_id", E2E_ORG_ID);
    await sb.from("purchase_orders").delete().eq("organization_id", E2E_ORG_ID);
    await sb.from("command_history").delete().eq("organization_id", E2E_ORG_ID);
    await sb.from("report_templates").delete().eq("organization_id", E2E_ORG_ID);
    await sb.from("approval_rules").delete().eq("organization_id", E2E_ORG_ID);
    await sb.from("inventory_items").delete().eq("organization_id", E2E_ORG_ID);
    await sb.from("units").delete().eq("organization_id", E2E_ORG_ID);
    await sb.from("suppliers").delete().eq("organization_id", E2E_ORG_ID);
    await sb.from("departments").delete().eq("organization_id", E2E_ORG_ID);
    await sb.from("po_groups").delete().eq("organization_id", E2E_ORG_ID);
    await sb.from("user_roles").delete().eq("organization_id", E2E_ORG_ID);
    await sb.from("profiles").delete().eq("organization_id", E2E_ORG_ID);

    // Delete auth users that belonged to this org
    for (const uid of existingUserIds) {
      await sb.auth.admin.deleteUser(uid);
    }

    if (action === "cleanup") {
      // Just wipe — delete the org too
      await sb.from("organizations").delete().eq("id", E2E_ORG_ID);
      return new Response(
        JSON.stringify({ success: true, action: "cleanup" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== CREATE/UPSERT test org =====
    await sb.from("organizations").upsert(
      {
        id: E2E_ORG_ID,
        name: "E2E Test Organization",
        industry: "Testing",
        is_onboarded: true,
      },
      { onConflict: "id" }
    );

    // ===== CREATE test user =====
    const { data: userData, error: userErr } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (userErr) throw new Error(`Failed to create test user: ${userErr.message}`);

    const userId = userData.user.id;

    // Create profile
    await sb.from("profiles").insert({
      user_id: userId,
      organization_id: E2E_ORG_ID,
      full_name: fullName,
      email,
    });

    // Assign admin role so tests can access all features
    await sb.from("user_roles").insert({
      user_id: userId,
      organization_id: E2E_ORG_ID,
      role: "admin",
    });

    // Also assign other roles so all sidebar links are visible
    for (const role of ["procurement", "sales", "finance"]) {
      await sb.from("user_roles").insert({
        user_id: userId,
        organization_id: E2E_ORG_ID,
        role,
      });
    }

    // ===== SEED minimal test data =====
    // Suppliers
    const suppliers = [
      { name: "E2E Supplier Alpha", contact_name: "Test Contact", contact_email: "alpha@test.com", organization_id: E2E_ORG_ID },
      { name: "E2E Supplier Beta", contact_name: "Beta Contact", contact_email: "beta@test.com", organization_id: E2E_ORG_ID },
    ];
    const { data: suppData } = await sb.from("suppliers").insert(suppliers).select("id");
    const suppAlphaId = suppData?.[0]?.id;

    // Departments
    const departments = [
      { name: "E2E Engineering", organization_id: E2E_ORG_ID },
      { name: "E2E Operations", organization_id: E2E_ORG_ID },
    ];
    await sb.from("departments").insert(departments);

    // Inventory items
    const items = [
      { name: "E2E Resale Widget", sku: "E2E-RW-01", item_type: "resale", default_unit_cost: 100, reorder_point: 5, preferred_supplier_id: suppAlphaId, organization_id: E2E_ORG_ID },
      { name: "E2E Mfg Input Part", sku: "E2E-MI-01", item_type: "manufacturing_input", default_unit_cost: 25, reorder_point: 10, preferred_supplier_id: suppAlphaId, organization_id: E2E_ORG_ID },
      { name: "E2E Consumable Item", sku: "E2E-CS-01", item_type: "consumable", default_unit_cost: 5, reorder_point: 20, organization_id: E2E_ORG_ID },
    ];
    const { data: itemData } = await sb.from("inventory_items").insert(items).select("id");
    const resaleItemId = itemData?.[0]?.id;
    const mfgInputId = itemData?.[1]?.id;

    // BOM entry (so assemblies page can test auto-populate)
    if (resaleItemId && mfgInputId) {
      await sb.from("bill_of_materials").insert({
        organization_id: E2E_ORG_ID,
        finished_item_id: resaleItemId,
        component_item_id: mfgInputId,
        quantity_per_unit: 3,
        notes: "E2E test BOM entry",
      });
    }

    // Seed some stock via inventory movements
    if (mfgInputId) {
      await sb.from("inventory_movements").insert({
        organization_id: E2E_ORG_ID,
        item_id: mfgInputId,
        movement_type: "purchase",
        quantity: 50,
        source_type: "manual",
        created_by: userId,
        notes: "E2E initial stock",
      });
    }
    if (resaleItemId) {
      await sb.from("inventory_movements").insert({
        organization_id: E2E_ORG_ID,
        item_id: resaleItemId,
        movement_type: "purchase",
        quantity: 20,
        source_type: "manual",
        created_by: userId,
        notes: "E2E initial stock",
      });
    }

    // Units
    await sb.from("units").insert([
      { unit_number: "E2E-U1", description: "E2E Test Unit 1", organization_id: E2E_ORG_ID },
    ]);

    // A sample PO
    const { data: poData } = await sb.from("purchase_orders").insert({
      po_number: "PO-E2E-001",
      supplier_id: suppAlphaId,
      status: "submitted",
      total_amount: 500,
      created_by: userId,
      organization_id: E2E_ORG_ID,
      notes: "E2E test purchase order",
    }).select("id");

    if (poData?.[0]?.id && resaleItemId) {
      await sb.from("purchase_order_items").insert({
        purchase_order_id: poData[0].id,
        item_id: resaleItemId,
        quantity: 5,
        unit_cost: 100,
        item_type: "resale",
        organization_id: E2E_ORG_ID,
      });
    }

    // A sample SO
    const { data: soData } = await sb.from("sales_orders").insert({
      so_number: "SO-E2E-001",
      customer_name: "E2E Test Customer",
      status: "order",
      total_amount: 1000,
      created_by: userId,
      organization_id: E2E_ORG_ID,
    }).select("id");

    if (soData?.[0]?.id && resaleItemId) {
      await sb.from("sales_order_items").insert({
        sales_order_id: soData[0].id,
        item_id: resaleItemId,
        quantity: 10,
        unit_price: 100,
        cost_per_unit: 75,
        organization_id: E2E_ORG_ID,
      });
    }

    // Approval rule
    await sb.from("approval_rules").insert({
      organization_id: E2E_ORG_ID,
      min_amount: 1000,
      required_role: "admin",
    });

    return new Response(
      JSON.stringify({
        success: true,
        action: "reset",
        org_id: E2E_ORG_ID,
        user_id: userId,
        email,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
