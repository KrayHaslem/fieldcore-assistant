import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ORG_ID = "00000000-0000-0000-0000-000000000001";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Create demo users
    const demoUsers = [
      { email: "admin@innovex.demo", password: "demo1234", name: "Ray Haslem", role: "admin" },
      { email: "procurement@innovex.demo", password: "demo1234", name: "Sarah Mitchell", role: "procurement" },
      { email: "sales@innovex.demo", password: "demo1234", name: "Marcus Chen", role: "sales" },
      { email: "finance@innovex.demo", password: "demo1234", name: "Diana Flores", role: "finance" },
      { email: "employee@innovex.demo", password: "demo1234", name: "Jake Thompson", role: "employee" },
      { email: "procurement2@innovex.demo", password: "demo1234", name: "Lisa Park", role: "procurement" },
      { email: "sales2@innovex.demo", password: "demo1234", name: "Tom Rodriguez", role: "sales" },
      { email: "employee2@innovex.demo", password: "demo1234", name: "Kelly Brown", role: "employee" },
    ];

    const userIds: Record<string, string> = {};

    for (const u of demoUsers) {
      // Check if user exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existing = existingUsers?.users?.find((eu: any) => eu.email === u.email);

      let userId: string;
      if (existing) {
        userId = existing.id;
      } else {
        const { data, error } = await supabase.auth.admin.createUser({
          email: u.email,
          password: u.password,
          email_confirm: true,
          user_metadata: { full_name: u.name },
        });
        if (error) throw new Error(`Failed to create ${u.email}: ${error.message}`);
        userId = data.user.id;
      }
      userIds[u.email] = userId;

      // Upsert profile
      await supabase.from("profiles").upsert({
        user_id: userId,
        organization_id: ORG_ID,
        full_name: u.name,
        email: u.email,
      }, { onConflict: "user_id" });

      // Upsert role
      await supabase.from("user_roles").upsert({
        user_id: userId,
        organization_id: ORG_ID,
        role: u.role,
      }, { onConflict: "user_id,role,organization_id" });
    }

    const adminId = userIds["admin@innovex.demo"];
    const procId = userIds["procurement@innovex.demo"];
    const salesId = userIds["sales@innovex.demo"];
    const empId = userIds["employee@innovex.demo"];
    const proc2Id = userIds["procurement2@innovex.demo"];
    const sales2Id = userIds["sales2@innovex.demo"];
    const emp2Id = userIds["employee2@innovex.demo"];

    // Seed Purchase Orders
    const poData = [
      { id: "00000000-0000-0000-0005-000000000001", po_number: "PO-2025-001", supplier_id: "00000000-0000-0000-0002-000000000001", department_id: "00000000-0000-0000-0001-000000000003", status: "closed", total_amount: 540.00, created_by: procId, notes: "MIG wire restock" },
      { id: "00000000-0000-0000-0005-000000000002", po_number: "PO-2025-002", supplier_id: "00000000-0000-0000-0002-000000000003", department_id: "00000000-0000-0000-0001-000000000001", status: "received", total_amount: 4900.00, created_by: procId, notes: "Steel plate order for Q1 production" },
      { id: "00000000-0000-0000-0005-000000000003", po_number: "PO-2025-003", supplier_id: "00000000-0000-0000-0002-000000000006", department_id: "00000000-0000-0000-0001-000000000001", status: "approved", total_amount: 3840.00, created_by: empId, notes: "Pump components for March builds" },
      { id: "00000000-0000-0000-0005-000000000004", po_number: "PO-2025-004", supplier_id: "00000000-0000-0000-0002-000000000002", department_id: "00000000-0000-0000-0001-000000000004", status: "ordered", total_amount: 156.00, created_by: emp2Id, notes: "Truck maintenance supplies" },
      { id: "00000000-0000-0000-0005-000000000005", po_number: "PO-2025-005", supplier_id: "00000000-0000-0000-0002-000000000007", department_id: "00000000-0000-0000-0001-000000000005", status: "submitted", total_amount: 680.00, created_by: empId, notes: "Quarterly safety supplies" },
      { id: "00000000-0000-0000-0005-000000000006", po_number: "PO-2025-006", supplier_id: "00000000-0000-0000-0002-000000000004", department_id: "00000000-0000-0000-0001-000000000001", status: "draft", total_amount: 960.00, created_by: procId, notes: "Flanges for upcoming production run" },
      { id: "00000000-0000-0000-0005-000000000007", po_number: "PO-2025-007", supplier_id: "00000000-0000-0000-0002-000000000005", department_id: "00000000-0000-0000-0001-000000000001", status: "closed", total_amount: 2125.00, created_by: proc2Id, notes: "Bearing assemblies for inventory" },
      { id: "00000000-0000-0000-0005-000000000008", po_number: "PO-2025-008", supplier_id: "00000000-0000-0000-0002-000000000003", department_id: "00000000-0000-0000-0001-000000000001", status: "received", total_amount: 1650.00, created_by: procId, notes: "Steel pipe for Q1" },
      { id: "00000000-0000-0000-0005-000000000009", po_number: "PO-2025-009", supplier_id: "00000000-0000-0000-0002-000000000008", department_id: "00000000-0000-0000-0001-000000000001", status: "ordered", total_amount: 475.00, created_by: procId, notes: "Electrical wire for production units" },
      { id: "00000000-0000-0000-0005-000000000010", po_number: "PO-2025-010", supplier_id: "00000000-0000-0000-0002-000000000001", department_id: "00000000-0000-0000-0001-000000000001", status: "submitted", total_amount: 224.00, created_by: emp2Id, notes: "Cutting and grinding supplies" },
      { id: "00000000-0000-0000-0005-000000000011", po_number: "PO-2025-011", supplier_id: "00000000-0000-0000-0002-000000000002", department_id: "00000000-0000-0000-0001-000000000004", status: "closed", total_amount: 78.00, created_by: empId, notes: "Hydraulic hose for crane" },
      { id: "00000000-0000-0000-0005-000000000012", po_number: "PO-2025-012", supplier_id: "00000000-0000-0000-0002-000000000006", department_id: "00000000-0000-0000-0001-000000000001", status: "approved", total_amount: 5200.00, created_by: procId, notes: "Sucker rod pumps for resale stock" },
    ];

    for (const po of poData) {
      await supabase.from("purchase_orders").upsert({
        ...po,
        organization_id: ORG_ID,
      }, { onConflict: "id" });
    }

    // Seed Sales Orders
    const soData = [
      { id: "00000000-0000-0000-0006-000000000001", so_number: "SO-2025-001", customer_name: "Permian Basin Energy", status: "paid", total_amount: 12250.00, created_by: salesId },
      { id: "00000000-0000-0000-0006-000000000002", so_number: "SO-2025-002", customer_name: "West Texas Drilling Co", status: "fulfilled", total_amount: 7600.00, created_by: salesId },
      { id: "00000000-0000-0000-0006-000000000003", so_number: "SO-2025-003", customer_name: "Midland Production LLC", status: "order", total_amount: 18500.00, created_by: sales2Id },
      { id: "00000000-0000-0000-0006-000000000004", so_number: "SO-2025-004", customer_name: "Eagle Ford Operations", status: "invoiced", total_amount: 4450.00, created_by: salesId },
      { id: "00000000-0000-0000-0006-000000000005", so_number: "SO-2025-005", customer_name: "Concho Resources", status: "quote", total_amount: 9800.00, created_by: sales2Id },
      { id: "00000000-0000-0000-0006-000000000006", so_number: "SO-2025-006", customer_name: "Pioneer Natural Resources", status: "order", total_amount: 26750.00, created_by: salesId },
      { id: "00000000-0000-0000-0006-000000000007", so_number: "SO-2025-007", customer_name: "Diamondback Energy", status: "closed", total_amount: 5200.00, created_by: sales2Id },
    ];

    for (const so of soData) {
      await supabase.from("sales_orders").upsert({
        ...so,
        organization_id: ORG_ID,
      }, { onConflict: "id" });
    }

    // Seed inventory movements (receiving from closed/received POs)
    const movements = [
      // Received from PO-001 (MIG wire)
      { item_id: "00000000-0000-0000-0004-000000000010", movement_type: "received", quantity: 12, source_type: "purchase_order", source_id: "00000000-0000-0000-0005-000000000001", created_by: procId },
      // Received from PO-002 (Steel plates)
      { item_id: "00000000-0000-0000-0004-000000000006", movement_type: "received", quantity: 20, source_type: "purchase_order", source_id: "00000000-0000-0000-0005-000000000002", created_by: procId },
      { item_id: "00000000-0000-0000-0004-000000000007", movement_type: "received", quantity: 10, source_type: "purchase_order", source_id: "00000000-0000-0000-0005-000000000002", created_by: procId },
      // Received from PO-007 (Bearings)
      { item_id: "00000000-0000-0000-0004-000000000009", movement_type: "received", quantity: 25, source_type: "purchase_order", source_id: "00000000-0000-0000-0005-000000000007", created_by: proc2Id },
      // Received from PO-008 (Steel pipe)
      { item_id: "00000000-0000-0000-0004-000000000012", movement_type: "received", quantity: 10, source_type: "purchase_order", source_id: "00000000-0000-0000-0005-000000000008", created_by: procId },
      // Assembly: 5 Pump Housing 4" produced
      { item_id: "00000000-0000-0000-0004-000000000001", movement_type: "assembled", quantity: 5, source_type: "assembly_record", source_id: null, created_by: empId },
      // Components consumed for assembly
      { item_id: "00000000-0000-0000-0004-000000000006", movement_type: "consumption", quantity: -5, source_type: "assembly_record", source_id: null, created_by: empId },
      { item_id: "00000000-0000-0000-0004-000000000008", movement_type: "consumption", quantity: -5, source_type: "assembly_record", source_id: null, created_by: empId },
      { item_id: "00000000-0000-0000-0004-000000000009", movement_type: "consumption", quantity: -5, source_type: "assembly_record", source_id: null, created_by: empId },
      { item_id: "00000000-0000-0000-0004-000000000011", movement_type: "consumption", quantity: -5, source_type: "assembly_record", source_id: null, created_by: empId },
      // Assembly: 3 Pump Housing 6" produced
      { item_id: "00000000-0000-0000-0004-000000000002", movement_type: "assembled", quantity: 3, source_type: "assembly_record", source_id: null, created_by: empId },
      { item_id: "00000000-0000-0000-0004-000000000007", movement_type: "consumption", quantity: -3, source_type: "assembly_record", source_id: null, created_by: empId },
      { item_id: "00000000-0000-0000-0004-000000000008", movement_type: "consumption", quantity: -3, source_type: "assembly_record", source_id: null, created_by: empId },
      { item_id: "00000000-0000-0000-0004-000000000009", movement_type: "consumption", quantity: -3, source_type: "assembly_record", source_id: null, created_by: empId },
      // Sales deductions
      { item_id: "00000000-0000-0000-0004-000000000001", movement_type: "sale", quantity: -2, source_type: "sales_order", source_id: "00000000-0000-0000-0006-000000000001", created_by: salesId },
      { item_id: "00000000-0000-0000-0004-000000000002", movement_type: "sale", quantity: -1, source_type: "sales_order", source_id: "00000000-0000-0000-0006-000000000002", created_by: salesId },
      { item_id: "00000000-0000-0000-0004-000000000005", movement_type: "sale", quantity: -5, source_type: "sales_order", source_id: "00000000-0000-0000-0006-000000000004", created_by: salesId },
      // Received gate valves
      { item_id: "00000000-0000-0000-0004-000000000005", movement_type: "received", quantity: 15, source_type: "purchase_order", source_id: null, created_by: procId },
      // Consumables received
      { item_id: "00000000-0000-0000-0004-000000000019", movement_type: "received", quantity: 100, source_type: "purchase_order", source_id: null, created_by: empId },
      { item_id: "00000000-0000-0000-0004-000000000020", movement_type: "received", quantity: 50, source_type: "purchase_order", source_id: null, created_by: empId },
      { item_id: "00000000-0000-0000-0004-000000000021", movement_type: "received", quantity: 10, source_type: "purchase_order", source_id: null, created_by: empId },
      { item_id: "00000000-0000-0000-0004-000000000024", movement_type: "received", quantity: 15, source_type: "purchase_order", source_id: null, created_by: empId },
      // Reconciliation adjustment
      { item_id: "00000000-0000-0000-0004-000000000010", movement_type: "reconciliation", quantity: -2, source_type: "reconciliation", source_id: null, created_by: procId },
    ];

    for (const m of movements) {
      await supabase.from("inventory_movements").insert({
        ...m,
        organization_id: ORG_ID,
      });
    }

    // Seed assembly records
    const assemblies = [
      { id: "00000000-0000-0000-0007-000000000001", finished_item_id: "00000000-0000-0000-0004-000000000001", quantity_produced: 5, notes: "Q1 batch - 4\" pump housings", created_by: empId },
      { id: "00000000-0000-0000-0007-000000000002", finished_item_id: "00000000-0000-0000-0004-000000000002", quantity_produced: 3, notes: "Q1 batch - 6\" pump housings", created_by: empId },
      { id: "00000000-0000-0000-0007-000000000003", finished_item_id: "00000000-0000-0000-0004-000000000001", quantity_produced: 2, notes: "Rush order for Permian Basin Energy", created_by: emp2Id },
    ];

    for (const a of assemblies) {
      await supabase.from("assembly_records").upsert({
        ...a,
        organization_id: ORG_ID,
      }, { onConflict: "id" });
    }

    // Seed reconciliations
    const reconciliations = [
      { item_id: "00000000-0000-0000-0004-000000000010", expected_quantity: 12, actual_quantity: 10, variance: -2, notes: "2 spools unaccounted for - possible unreported usage", created_by: procId },
      { item_id: "00000000-0000-0000-0004-000000000019", expected_quantity: 100, actual_quantity: 94, variance: -6, notes: "Glasses distributed without logging", created_by: procId },
      { item_id: "00000000-0000-0000-0004-000000000009", expected_quantity: 17, actual_quantity: 17, variance: 0, notes: "Bearings count confirmed accurate", created_by: proc2Id },
      { item_id: "00000000-0000-0000-0004-000000000005", expected_quantity: 10, actual_quantity: 11, variance: 1, notes: "Found 1 extra gate valve in back storage", created_by: procId },
    ];

    for (const r of reconciliations) {
      await supabase.from("reconciliations").insert({
        ...r,
        organization_id: ORG_ID,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Demo data seeded successfully",
      users: demoUsers.map(u => ({ email: u.email, password: u.password, role: u.role })),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Seed error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
