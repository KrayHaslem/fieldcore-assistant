import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ORG_ID = "00000000-0000-0000-0000-000000000001";

// Fixed UUIDs for idempotency
const DEPT = {
  manufacturing: "00000000-0000-0000-0001-000000000001",
  sales:         "00000000-0000-0000-0001-000000000002",
  procurement:   "00000000-0000-0000-0001-000000000003",
  maintenance:   "00000000-0000-0000-0001-000000000004",
  office:        "00000000-0000-0000-0001-000000000005",
};

const SUP = {
  logan:    "00000000-0000-0000-0002-000000000001",
  simper:   "00000000-0000-0000-0002-000000000002",
  swsteel:  "00000000-0000-0000-0002-000000000003",
  hydro:    "00000000-0000-0000-0002-000000000004",
  safety:   "00000000-0000-0000-0002-000000000005",
  office:   "00000000-0000-0000-0002-000000000006",
  breakroom:"00000000-0000-0000-0002-000000000007",
  premier:  "00000000-0000-0000-0002-000000000008",
};

// Item IDs: 0004-000000000001 through 0004-000000000025
const I = (n: number) => `00000000-0000-0000-0004-${String(n).padStart(12, "0")}`;
const PO = (n: number) => `00000000-0000-0000-0005-${String(n).padStart(12, "0")}`;
const SO = (n: number) => `00000000-0000-0000-0006-${String(n).padStart(12, "0")}`;
const AR = (n: number) => `00000000-0000-0000-0007-${String(n).padStart(12, "0")}`;
const UNIT = (n: number) => `00000000-0000-0000-0003-${String(n).padStart(12, "0")}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // ===== STEP 1: CLEAR existing demo data =====
    // Get existing demo user IDs from profiles
    const { data: existingProfiles } = await sb.from("profiles").select("user_id").eq("organization_id", ORG_ID);
    const existingUserIds = (existingProfiles ?? []).map((p: any) => p.user_id);

    // Delete in dependency order
    await sb.from("reconciliations").delete().eq("organization_id", ORG_ID);
    await sb.from("inventory_movements").delete().eq("organization_id", ORG_ID);
    await sb.from("assembly_record_components").delete().in("assembly_record_id", [AR(1), AR(2), AR(3), AR(4)]);
    await sb.from("assembly_records").delete().eq("organization_id", ORG_ID);
    await sb.from("sales_order_items").delete().eq("organization_id", ORG_ID);
    await sb.from("sales_orders").delete().eq("organization_id", ORG_ID);
    await sb.from("purchase_order_items").delete().eq("organization_id", ORG_ID);
    await sb.from("purchase_orders").delete().eq("organization_id", ORG_ID);
    await sb.from("command_history").delete().eq("organization_id", ORG_ID);
    await sb.from("approval_rules").delete().eq("organization_id", ORG_ID);
    await sb.from("inventory_items").delete().eq("organization_id", ORG_ID);
    await sb.from("units").delete().eq("organization_id", ORG_ID);
    await sb.from("suppliers").delete().eq("organization_id", ORG_ID);
    await sb.from("departments").delete().eq("organization_id", ORG_ID);
    await sb.from("user_roles").delete().eq("organization_id", ORG_ID);
    await sb.from("profiles").delete().eq("organization_id", ORG_ID);

    // Delete auth users
    for (const uid of existingUserIds) {
      await sb.auth.admin.deleteUser(uid);
    }

    // ===== STEP 2: ORGANIZATION =====
    await sb.from("organizations").upsert({
      id: ORG_ID, name: "Innovex Oilfield Equipment", industry: "Oilfield Manufacturing & Distribution",
    }, { onConflict: "id" });

    // ===== STEP 3: DEPARTMENTS =====
    const departments = [
      { id: DEPT.manufacturing, name: "Manufacturing", organization_id: ORG_ID },
      { id: DEPT.sales, name: "Sales", organization_id: ORG_ID },
      { id: DEPT.procurement, name: "Procurement", organization_id: ORG_ID },
      { id: DEPT.maintenance, name: "Maintenance", organization_id: ORG_ID },
      { id: DEPT.office, name: "Office", organization_id: ORG_ID },
    ];
    for (const d of departments) await sb.from("departments").upsert(d, { onConflict: "id" });

    // ===== STEP 4: USERS =====
    const demoUsers = [
      { email: "sarah@innovex.demo", password: "demo1234", name: "Sarah Mitchell", roles: ["admin", "procurement"] },
      { email: "james@innovex.demo", password: "demo1234", name: "James Pryor", roles: ["procurement"] },
      { email: "dana@innovex.demo", password: "demo1234", name: "Dana Okafor", roles: ["sales"] },
      { email: "kyle@innovex.demo", password: "demo1234", name: "Kyle Baird", roles: ["finance"] },
      { email: "maria@innovex.demo", password: "demo1234", name: "Maria Voss", roles: ["employee"] },
    ];

    const userIds: Record<string, string> = {};
    for (const u of demoUsers) {
      const { data, error } = await sb.auth.admin.createUser({
        email: u.email, password: u.password, email_confirm: true,
        user_metadata: { full_name: u.name },
      });
      if (error) throw new Error(`Failed to create ${u.email}: ${error.message}`);
      const uid = data.user.id;
      userIds[u.email] = uid;

      await sb.from("profiles").insert({ user_id: uid, organization_id: ORG_ID, full_name: u.name, email: u.email });
      for (const role of u.roles) {
        await sb.from("user_roles").insert({ user_id: uid, organization_id: ORG_ID, role });
      }
    }

    const sarah = userIds["sarah@innovex.demo"];
    const james = userIds["james@innovex.demo"];
    const dana = userIds["dana@innovex.demo"];
    const maria = userIds["maria@innovex.demo"];

    // ===== STEP 5: SUPPLIERS =====
    const suppliers = [
      { id: SUP.logan, name: "Logan Supply", contact_name: "Mike Logan", contact_email: "mike@logansupply.com", contact_phone: "432-555-0101", organization_id: ORG_ID, avg_lead_time_days: 5 },
      { id: SUP.simper, name: "Simper Supply", contact_name: "Tom Simper", contact_email: "tom@simpersupply.com", contact_phone: "432-555-0102", organization_id: ORG_ID, avg_lead_time_days: 10 },
      { id: SUP.swsteel, name: "Southwest Steel", contact_name: "Laura Chen", contact_email: "laura@swsteel.com", contact_phone: "432-555-0103", organization_id: ORG_ID, avg_lead_time_days: 14 },
      { id: SUP.hydro, name: "Hydro Parts Direct", contact_name: "Jeff Wells", contact_email: "jeff@hydroparts.com", contact_phone: "432-555-0104", organization_id: ORG_ID, avg_lead_time_days: 7 },
      { id: SUP.safety, name: "National Safety Supply", contact_name: "Karen White", contact_email: "karen@natsafety.com", contact_phone: "432-555-0105", organization_id: ORG_ID, avg_lead_time_days: 3 },
      { id: SUP.office, name: "Office Depot Business", contact_name: "Support Desk", contact_email: "orders@officedepot.com", contact_phone: "800-555-0106", organization_id: ORG_ID, avg_lead_time_days: 2 },
      { id: SUP.breakroom, name: "Breakroom Plus", contact_name: "Amy Ruiz", contact_email: "amy@breakroomplus.com", contact_phone: "432-555-0107", organization_id: ORG_ID, avg_lead_time_days: 3 },
      { id: SUP.premier, name: "Premier Equipment Sales", contact_name: "Dan Brooks", contact_email: "dan@premierequip.com", contact_phone: "432-555-0108", organization_id: ORG_ID, avg_lead_time_days: 21 },
    ];
    for (const s of suppliers) await sb.from("suppliers").upsert(s, { onConflict: "id" });

    // ===== STEP 6: INVENTORY ITEMS =====
    const items = [
      // Resale (1-5)
      { id: I(1), name: "Centrifugal Pump Housing 4\"", sku: "RPH-04", item_type: "resale", default_unit_cost: 1250, reorder_point: 5, preferred_supplier_id: SUP.premier, organization_id: ORG_ID },
      { id: I(2), name: "Triplex Pump Assembly", sku: "RPA-01", item_type: "resale", default_unit_cost: 4500, reorder_point: 2, preferred_supplier_id: SUP.premier, organization_id: ORG_ID },
      { id: I(3), name: "Gate Valve 3\"", sku: "RGV-03", item_type: "resale", default_unit_cost: 285, reorder_point: 10, preferred_supplier_id: SUP.hydro, organization_id: ORG_ID },
      { id: I(4), name: "Check Valve 2\"", sku: "RCV-02", item_type: "resale", default_unit_cost: 175, reorder_point: 10, preferred_supplier_id: SUP.hydro, organization_id: ORG_ID },
      { id: I(5), name: "Surface Safety Valve", sku: "RSV-01", item_type: "resale", default_unit_cost: 890, reorder_point: 3, preferred_supplier_id: SUP.premier, organization_id: ORG_ID },
      // Manufacturing Input (6-13)
      { id: I(6), name: "Raw Steel Plate 1/4\"", sku: "MSP-025", item_type: "manufacturing_input", default_unit_cost: 145, reorder_point: 20, preferred_supplier_id: SUP.swsteel, organization_id: ORG_ID },
      { id: I(7), name: "MIG Wire Spool ER70S-6", sku: "MWS-70", item_type: "manufacturing_input", default_unit_cost: 45, reorder_point: 10, preferred_supplier_id: SUP.logan, organization_id: ORG_ID },
      { id: I(8), name: "Pump Shaft Blank", sku: "MPB-01", item_type: "manufacturing_input", default_unit_cost: 320, reorder_point: 8, preferred_supplier_id: SUP.simper, organization_id: ORG_ID },
      { id: I(9), name: "Impeller Casting", sku: "MIC-01", item_type: "manufacturing_input", default_unit_cost: 280, reorder_point: 8, preferred_supplier_id: SUP.simper, organization_id: ORG_ID },
      { id: I(10), name: "Seal Kit Components", sku: "MSK-01", item_type: "manufacturing_input", default_unit_cost: 65, reorder_point: 15, preferred_supplier_id: SUP.simper, organization_id: ORG_ID },
      { id: I(11), name: "O-Ring Assortment", sku: "MOR-01", item_type: "manufacturing_input", default_unit_cost: 22, reorder_point: 20, preferred_supplier_id: SUP.hydro, organization_id: ORG_ID },
      { id: I(12), name: "Hydraulic Fitting Set", sku: "MHF-01", item_type: "manufacturing_input", default_unit_cost: 95, reorder_point: 10, preferred_supplier_id: SUP.hydro, organization_id: ORG_ID },
      { id: I(13), name: "Weld Rod 7018", sku: "MWR-70", item_type: "manufacturing_input", default_unit_cost: 38, reorder_point: 15, preferred_supplier_id: SUP.logan, organization_id: ORG_ID },
      // Internal Use (14-19)
      { id: I(14), name: "Engine Oil 5W-30", sku: "IEO-530", item_type: "internal_use", default_unit_cost: 32, reorder_point: 10, organization_id: ORG_ID },
      { id: I(15), name: "Hydraulic Fluid AW46", sku: "IHF-46", item_type: "internal_use", default_unit_cost: 48, reorder_point: 8, organization_id: ORG_ID },
      { id: I(16), name: "Air Filter Assembly", sku: "IAF-01", item_type: "internal_use", default_unit_cost: 28, reorder_point: 6, organization_id: ORG_ID },
      { id: I(17), name: "Brake Pad Set", sku: "IBP-01", item_type: "internal_use", default_unit_cost: 65, reorder_point: 4, organization_id: ORG_ID },
      { id: I(18), name: "Transmission Filter", sku: "ITF-01", item_type: "internal_use", default_unit_cost: 18, reorder_point: 4, organization_id: ORG_ID },
      { id: I(19), name: "V-Belt Set", sku: "IVB-01", item_type: "internal_use", default_unit_cost: 42, reorder_point: 4, organization_id: ORG_ID },
      // Consumable (20-25)
      { id: I(20), name: "Safety Glasses", sku: "CSG-01", item_type: "consumable", default_unit_cost: 8, reorder_point: 50, preferred_supplier_id: SUP.safety, organization_id: ORG_ID },
      { id: I(21), name: "Nitrile Gloves (box)", sku: "CNG-01", item_type: "consumable", default_unit_cost: 12, reorder_point: 30, preferred_supplier_id: SUP.safety, organization_id: ORG_ID },
      { id: I(22), name: "Hard Hat", sku: "CHH-01", item_type: "consumable", default_unit_cost: 25, reorder_point: 10, preferred_supplier_id: SUP.safety, organization_id: ORG_ID },
      { id: I(23), name: "Paper Towel Roll", sku: "CPT-01", item_type: "consumable", default_unit_cost: 4, reorder_point: 40, preferred_supplier_id: SUP.breakroom, organization_id: ORG_ID },
      { id: I(24), name: "Coffee (case)", sku: "CCF-01", item_type: "consumable", default_unit_cost: 35, reorder_point: 5, preferred_supplier_id: SUP.breakroom, organization_id: ORG_ID },
      { id: I(25), name: "Printer Paper (case)", sku: "CPP-01", item_type: "consumable", default_unit_cost: 42, reorder_point: 5, preferred_supplier_id: SUP.office, organization_id: ORG_ID },
    ];
    for (const item of items) await sb.from("inventory_items").upsert(item, { onConflict: "id" });

    // ===== STEP 7: UNITS =====
    const units = [
      { id: UNIT(1), unit_number: "T-101", description: "Service Truck 2019 Ford F-350", organization_id: ORG_ID },
      { id: UNIT(2), unit_number: "T-102", description: "Service Truck 2021 Chevy 3500", organization_id: ORG_ID },
      { id: UNIT(3), unit_number: "V-2045", description: "Delivery Van 2020 Transit", organization_id: ORG_ID },
      { id: UNIT(4), unit_number: "SHOP", description: "Shop Equipment", organization_id: ORG_ID },
    ];
    for (const u of units) await sb.from("units").upsert(u, { onConflict: "id" });

    // ===== STEP 8: PURCHASE ORDERS =====
    const poData = [
      // Historical closed POs (pre-existing stock with full audit trail)
      { id: PO(13), po_number: "PO-2025-H01", supplier_id: SUP.hydro, department_id: DEPT.manufacturing, status: "closed", total_amount: 8985, created_by: sarah, created_at: "2025-06-10T09:00:00Z", approved_by: sarah, approved_at: "2025-06-10T10:00:00Z", ordered_at: "2025-06-11T08:00:00Z", received_at: "2025-06-18T14:00:00Z", notes: "Initial valve and o-ring stock" },
      { id: PO(14), po_number: "PO-2025-H02", supplier_id: SUP.premier, department_id: DEPT.manufacturing, status: "closed", total_amount: 7120, created_by: sarah, created_at: "2025-06-12T10:00:00Z", approved_by: sarah, approved_at: "2025-06-12T11:00:00Z", ordered_at: "2025-06-13T08:00:00Z", received_at: "2025-07-04T14:00:00Z", notes: "Safety valve opening stock" },
      { id: PO(15), po_number: "PO-2025-H03", supplier_id: SUP.simper, department_id: DEPT.manufacturing, status: "closed", total_amount: 9975, created_by: james, created_at: "2025-06-15T08:00:00Z", approved_by: sarah, approved_at: "2025-06-15T14:00:00Z", ordered_at: "2025-06-16T08:00:00Z", received_at: "2025-06-26T10:00:00Z", notes: "Pump components for initial assembly runs" },
      { id: PO(16), po_number: "PO-2025-H04", supplier_id: SUP.safety, department_id: DEPT.manufacturing, status: "closed", total_amount: 1775, created_by: maria, created_at: "2025-07-01T08:00:00Z", approved_by: sarah, approved_at: "2025-07-01T09:00:00Z", ordered_at: "2025-07-01T10:00:00Z", received_at: "2025-07-04T10:00:00Z", notes: "Initial safety supplies stock" },
      { id: PO(17), po_number: "PO-2025-H05", supplier_id: SUP.breakroom, department_id: DEPT.office, status: "closed", total_amount: 520, created_by: sarah, created_at: "2025-07-05T09:00:00Z", approved_by: sarah, approved_at: "2025-07-05T09:30:00Z", ordered_at: "2025-07-05T10:00:00Z", received_at: "2025-07-08T11:00:00Z", notes: "Breakroom supplies setup" },
      { id: PO(18), po_number: "PO-2025-H06", supplier_id: SUP.office, department_id: DEPT.office, status: "closed", total_amount: 420, created_by: sarah, created_at: "2025-07-05T09:00:00Z", approved_by: sarah, approved_at: "2025-07-05T09:30:00Z", ordered_at: "2025-07-05T10:00:00Z", received_at: "2025-07-08T11:00:00Z", notes: "Office supplies setup" },
      { id: PO(19), po_number: "PO-2025-H07", supplier_id: SUP.logan, department_id: DEPT.maintenance, status: "closed", total_amount: 2376, created_by: james, created_at: "2025-07-10T08:00:00Z", approved_by: sarah, approved_at: "2025-07-10T14:00:00Z", ordered_at: "2025-07-11T08:00:00Z", received_at: "2025-07-16T10:00:00Z", notes: "Fleet maintenance supplies — initial stock" },
      // Active POs
      { id: PO(1), po_number: "PO-2025-001", supplier_id: SUP.logan, department_id: DEPT.manufacturing, status: "closed", total_amount: 690, created_by: james, created_at: "2025-10-05T10:00:00Z", notes: "MIG wire and weld rod restock" },
      { id: PO(2), po_number: "PO-2025-002", supplier_id: SUP.swsteel, department_id: DEPT.manufacturing, status: "received", total_amount: 4350, created_by: james, created_at: "2025-10-18T14:00:00Z", notes: "Steel plates for Q1 production" },
      { id: PO(3), po_number: "PO-2025-003", supplier_id: SUP.simper, department_id: DEPT.manufacturing, status: "approved", total_amount: 6650, created_by: sarah, created_at: "2025-11-02T09:00:00Z", notes: "Pump components for March builds" },
      { id: PO(4), po_number: "PO-2025-004", supplier_id: SUP.hydro, department_id: DEPT.maintenance, status: "ordered", total_amount: 334, created_by: maria, created_at: "2025-11-15T11:00:00Z", notes: "Hydraulic fittings and fluid for trucks" },
      { id: PO(5), po_number: "PO-2025-005", supplier_id: SUP.safety, department_id: DEPT.manufacturing, status: "submitted", total_amount: 680, created_by: maria, created_at: "2025-12-01T08:00:00Z", notes: "Quarterly safety supplies" },
      { id: PO(6), po_number: "PO-2025-006", supplier_id: SUP.logan, department_id: DEPT.manufacturing, status: "draft", total_amount: 530, created_by: james, created_at: "2025-12-10T15:00:00Z", notes: "O-rings and seal kits draft" },
      { id: PO(7), po_number: "PO-2025-007", supplier_id: SUP.premier, department_id: DEPT.manufacturing, status: "closed", total_amount: 9000, created_by: sarah, created_at: "2026-01-08T10:00:00Z", notes: "Triplex pump assemblies for resale" },
      { id: PO(8), po_number: "PO-2025-008", supplier_id: SUP.swsteel, department_id: DEPT.manufacturing, status: "received", total_amount: 2900, created_by: james, created_at: "2026-01-20T13:00:00Z", notes: "Additional steel plates" },
      { id: PO(9), po_number: "PO-2025-009", supplier_id: SUP.office, department_id: DEPT.office, status: "ordered", total_amount: 252, created_by: sarah, created_at: "2026-02-03T09:00:00Z", notes: "Office supplies" },
      { id: PO(10), po_number: "PO-2025-010", supplier_id: SUP.logan, department_id: DEPT.manufacturing, status: "submitted", total_amount: 570, created_by: maria, created_at: "2026-02-15T10:00:00Z", notes: "Weld rod and MIG wire" },
      { id: PO(11), po_number: "PO-2025-011", supplier_id: SUP.hydro, department_id: DEPT.maintenance, status: "closed", total_amount: 190, created_by: james, created_at: "2026-02-25T14:00:00Z", notes: "Hydraulic fittings for crane" },
      { id: PO(12), po_number: "PO-2025-012", supplier_id: SUP.simper, department_id: DEPT.manufacturing, status: "approved", total_amount: 5300, created_by: sarah, created_at: "2026-03-01T08:00:00Z", notes: "Pump components for Q2 production" },
    ];
    for (const po of poData) await sb.from("purchase_orders").upsert({ ...po, organization_id: ORG_ID }, { onConflict: "id" });

    // PO Line Items
    const poItems = [
      // PO-001: MIG wire + weld rod
      { purchase_order_id: PO(1), item_id: I(7), quantity: 12, unit_cost: 45, item_type: "manufacturing_input", quantity_received: 12, organization_id: ORG_ID },
      { purchase_order_id: PO(1), item_id: I(13), quantity: 5, unit_cost: 38, item_type: "manufacturing_input", quantity_received: 5, organization_id: ORG_ID },
      // PO-002: Steel plates
      { purchase_order_id: PO(2), item_id: I(6), quantity: 30, unit_cost: 145, item_type: "manufacturing_input", quantity_received: 30, organization_id: ORG_ID },
      // PO-003: Pump shaft, impeller, seal kits
      { purchase_order_id: PO(3), item_id: I(8), quantity: 10, unit_cost: 320, item_type: "manufacturing_input", quantity_received: 0, organization_id: ORG_ID },
      { purchase_order_id: PO(3), item_id: I(9), quantity: 10, unit_cost: 280, item_type: "manufacturing_input", quantity_received: 0, organization_id: ORG_ID },
      { purchase_order_id: PO(3), item_id: I(10), quantity: 10, unit_cost: 65, item_type: "manufacturing_input", quantity_received: 0, organization_id: ORG_ID },
      // PO-004: Hydraulic fittings + fluid
      { purchase_order_id: PO(4), item_id: I(12), quantity: 2, unit_cost: 95, item_type: "manufacturing_input", quantity_received: 0, organization_id: ORG_ID },
      { purchase_order_id: PO(4), item_id: I(15), quantity: 3, unit_cost: 48, item_type: "internal_use", quantity_received: 0, organization_id: ORG_ID },
      // PO-005: Safety supplies
      { purchase_order_id: PO(5), item_id: I(20), quantity: 40, unit_cost: 8, item_type: "consumable", quantity_received: 0, organization_id: ORG_ID },
      { purchase_order_id: PO(5), item_id: I(21), quantity: 15, unit_cost: 12, item_type: "consumable", quantity_received: 0, organization_id: ORG_ID },
      { purchase_order_id: PO(5), item_id: I(22), quantity: 10, unit_cost: 25, item_type: "consumable", quantity_received: 0, organization_id: ORG_ID },
      // PO-006: O-rings + seal kits (draft)
      { purchase_order_id: PO(6), item_id: I(11), quantity: 15, unit_cost: 22, item_type: "manufacturing_input", quantity_received: 0, organization_id: ORG_ID },
      { purchase_order_id: PO(6), item_id: I(10), quantity: 2, unit_cost: 65, item_type: "manufacturing_input", quantity_received: 0, organization_id: ORG_ID },
      // PO-007: Triplex pump assemblies
      { purchase_order_id: PO(7), item_id: I(2), quantity: 2, unit_cost: 4500, item_type: "resale", quantity_received: 2, organization_id: ORG_ID },
      // PO-008: More steel plates
      { purchase_order_id: PO(8), item_id: I(6), quantity: 20, unit_cost: 145, item_type: "manufacturing_input", quantity_received: 20, organization_id: ORG_ID },
      // PO-009: Printer paper + coffee
      { purchase_order_id: PO(9), item_id: I(25), quantity: 4, unit_cost: 42, item_type: "consumable", quantity_received: 0, organization_id: ORG_ID },
      { purchase_order_id: PO(9), item_id: I(24), quantity: 2, unit_cost: 35, item_type: "consumable", quantity_received: 0, organization_id: ORG_ID },
      // PO-010: Weld rod + MIG wire
      { purchase_order_id: PO(10), item_id: I(13), quantity: 10, unit_cost: 38, item_type: "manufacturing_input", quantity_received: 0, organization_id: ORG_ID },
      { purchase_order_id: PO(10), item_id: I(7), quantity: 5, unit_cost: 45, item_type: "manufacturing_input", quantity_received: 0, organization_id: ORG_ID },
      // PO-011: Hydraulic fittings
      { purchase_order_id: PO(11), item_id: I(12), quantity: 2, unit_cost: 95, item_type: "manufacturing_input", quantity_received: 2, organization_id: ORG_ID },
      // PO-012: Pump components
      { purchase_order_id: PO(12), item_id: I(8), quantity: 8, unit_cost: 320, item_type: "manufacturing_input", quantity_received: 0, organization_id: ORG_ID },
      { purchase_order_id: PO(12), item_id: I(9), quantity: 8, unit_cost: 280, item_type: "manufacturing_input", quantity_received: 0, organization_id: ORG_ID },
      { purchase_order_id: PO(12), item_id: I(10), quantity: 8, unit_cost: 65, item_type: "manufacturing_input", quantity_received: 0, organization_id: ORG_ID },
      // Historical PO-H01 (hydro): gate valves, check valves, o-rings
      { purchase_order_id: PO(13), item_id: I(3), quantity: 20, unit_cost: 285, item_type: "resale", quantity_received: 20, organization_id: ORG_ID },
      { purchase_order_id: PO(13), item_id: I(4), quantity: 15, unit_cost: 175, item_type: "resale", quantity_received: 15, organization_id: ORG_ID },
      { purchase_order_id: PO(13), item_id: I(11), quantity: 30, unit_cost: 22, item_type: "manufacturing_input", quantity_received: 30, organization_id: ORG_ID },
      // Historical PO-H02 (premier): safety valves
      { purchase_order_id: PO(14), item_id: I(5), quantity: 8, unit_cost: 890, item_type: "resale", quantity_received: 8, organization_id: ORG_ID },
      // Historical PO-H03 (simper): pump shafts, impellers, seal kits
      { purchase_order_id: PO(15), item_id: I(8), quantity: 15, unit_cost: 320, item_type: "manufacturing_input", quantity_received: 15, organization_id: ORG_ID },
      { purchase_order_id: PO(15), item_id: I(9), quantity: 15, unit_cost: 280, item_type: "manufacturing_input", quantity_received: 15, organization_id: ORG_ID },
      { purchase_order_id: PO(15), item_id: I(10), quantity: 15, unit_cost: 65, item_type: "manufacturing_input", quantity_received: 15, organization_id: ORG_ID },
      // Historical PO-H04 (safety): safety glasses, gloves, hard hats
      { purchase_order_id: PO(16), item_id: I(20), quantity: 100, unit_cost: 8, item_type: "consumable", quantity_received: 100, organization_id: ORG_ID },
      { purchase_order_id: PO(16), item_id: I(21), quantity: 50, unit_cost: 12, item_type: "consumable", quantity_received: 50, organization_id: ORG_ID },
      { purchase_order_id: PO(16), item_id: I(22), quantity: 15, unit_cost: 25, item_type: "consumable", quantity_received: 15, organization_id: ORG_ID },
      // Historical PO-H05 (breakroom): paper towels, coffee
      { purchase_order_id: PO(17), item_id: I(23), quantity: 60, unit_cost: 4, item_type: "consumable", quantity_received: 60, organization_id: ORG_ID },
      { purchase_order_id: PO(17), item_id: I(24), quantity: 8, unit_cost: 35, item_type: "consumable", quantity_received: 8, organization_id: ORG_ID },
      // Historical PO-H06 (office): printer paper
      { purchase_order_id: PO(18), item_id: I(25), quantity: 10, unit_cost: 42, item_type: "consumable", quantity_received: 10, organization_id: ORG_ID },
      // Historical PO-H07 (logan): fleet maintenance supplies
      { purchase_order_id: PO(19), item_id: I(14), quantity: 20, unit_cost: 32, item_type: "internal_use", quantity_received: 20, organization_id: ORG_ID },
      { purchase_order_id: PO(19), item_id: I(15), quantity: 12, unit_cost: 48, item_type: "internal_use", quantity_received: 12, organization_id: ORG_ID },
      { purchase_order_id: PO(19), item_id: I(16), quantity: 10, unit_cost: 28, item_type: "internal_use", quantity_received: 10, organization_id: ORG_ID },
      { purchase_order_id: PO(19), item_id: I(17), quantity: 8, unit_cost: 65, item_type: "internal_use", quantity_received: 8, organization_id: ORG_ID },
      { purchase_order_id: PO(19), item_id: I(18), quantity: 6, unit_cost: 18, item_type: "internal_use", quantity_received: 6, organization_id: ORG_ID },
      { purchase_order_id: PO(19), item_id: I(19), quantity: 6, unit_cost: 42, item_type: "internal_use", quantity_received: 6, organization_id: ORG_ID },
    ];
    for (const li of poItems) await sb.from("purchase_order_items").insert(li);

    // ===== STEP 9: SALES ORDERS =====
    const soData = [
      { id: SO(1), so_number: "SO-2025-001", customer_name: "Permian Basin Energy", status: "closed", total_amount: 6250, created_by: dana, created_at: "2025-11-10T10:00:00Z" },
      { id: SO(2), so_number: "SO-2025-002", customer_name: "West Texas Drilling Co", status: "fulfilled", total_amount: 4785, created_by: dana, created_at: "2025-12-05T14:00:00Z" },
      { id: SO(3), so_number: "SO-2025-003", customer_name: "Midland Production LLC", status: "order", total_amount: 9570, created_by: dana, created_at: "2026-01-15T09:00:00Z" },
      { id: SO(4), so_number: "SO-2025-004", customer_name: "Eagle Ford Operations", status: "fulfilled", total_amount: 2675, created_by: dana, created_at: "2026-02-01T11:00:00Z" },
      { id: SO(5), so_number: "SO-2025-005", customer_name: "Concho Resources", status: "quote", total_amount: 13500, created_by: dana, created_at: "2026-02-20T08:00:00Z" },
      { id: SO(6), so_number: "SO-2025-006", customer_name: "Pioneer Natural Resources", status: "order", total_amount: 5340, created_by: dana, created_at: "2026-03-05T10:00:00Z" },
    ];
    for (const so of soData) await sb.from("sales_orders").upsert({ ...so, organization_id: ORG_ID }, { onConflict: "id" });

    // SO Line Items
    const soItems = [
      // SO-001: 5 pump housings
      { sales_order_id: SO(1), item_id: I(1), quantity: 5, unit_price: 1250, organization_id: ORG_ID },
      // SO-002: 3 gate valves + 3 check valves + 1 pump housing
      { sales_order_id: SO(2), item_id: I(3), quantity: 3, unit_price: 395, organization_id: ORG_ID },
      { sales_order_id: SO(2), item_id: I(4), quantity: 3, unit_price: 250, organization_id: ORG_ID },
      { sales_order_id: SO(2), item_id: I(1), quantity: 2, unit_price: 1500, organization_id: ORG_ID },
      // SO-003: 2 triplex pumps + 3 safety valves
      { sales_order_id: SO(3), item_id: I(2), quantity: 1, unit_price: 5400, organization_id: ORG_ID },
      { sales_order_id: SO(3), item_id: I(5), quantity: 3, unit_price: 1390, organization_id: ORG_ID },
      // SO-004: 5 gate valves + 5 check valves
      { sales_order_id: SO(4), item_id: I(3), quantity: 5, unit_price: 310, organization_id: ORG_ID },
      { sales_order_id: SO(4), item_id: I(4), quantity: 5, unit_price: 225, organization_id: ORG_ID },
      // SO-005: 3 triplex pumps (quote)
      { sales_order_id: SO(5), item_id: I(2), quantity: 3, unit_price: 4500, organization_id: ORG_ID },
      // SO-006: 4 pump housings
      { sales_order_id: SO(6), item_id: I(1), quantity: 4, unit_price: 1335, organization_id: ORG_ID },
    ];
    for (const li of soItems) await sb.from("sales_order_items").insert(li);

    // ===== STEP 10: ASSEMBLY RECORDS =====
    // Each pump housing consumes: 2x steel plate, 1x shaft, 1x impeller, 1x seal kit
    const assemblies = [
      { id: AR(1), finished_item_id: I(1), quantity_produced: 5, notes: "Q4 batch - 4\" pump housings", created_by: maria, created_at: "2025-11-01T08:00:00Z", organization_id: ORG_ID },
      { id: AR(2), finished_item_id: I(1), quantity_produced: 3, notes: "December production run", created_by: maria, created_at: "2025-12-15T08:00:00Z", organization_id: ORG_ID },
      { id: AR(3), finished_item_id: I(1), quantity_produced: 2, notes: "Rush order for Permian Basin", created_by: maria, created_at: "2026-01-20T08:00:00Z", organization_id: ORG_ID },
      { id: AR(4), finished_item_id: I(1), quantity_produced: 2, notes: "February production", created_by: maria, created_at: "2026-02-10T08:00:00Z", organization_id: ORG_ID },
    ];
    for (const a of assemblies) await sb.from("assembly_records").upsert(a, { onConflict: "id" });

    // Assembly components (BOM per pump housing: 2 steel, 1 shaft, 1 impeller, 1 seal kit)
    const asmComponents: { assembly_record_id: string; component_item_id: string; quantity_consumed: number }[] = [];
    for (const a of assemblies) {
      const qty = a.quantity_produced;
      asmComponents.push(
        { assembly_record_id: a.id, component_item_id: I(6), quantity_consumed: qty * 2 },
        { assembly_record_id: a.id, component_item_id: I(8), quantity_consumed: qty },
        { assembly_record_id: a.id, component_item_id: I(9), quantity_consumed: qty },
        { assembly_record_id: a.id, component_item_id: I(10), quantity_consumed: qty },
      );
    }
    for (const c of asmComponents) await sb.from("assembly_record_components").insert(c);

    // ===== STEP 11: INVENTORY MOVEMENTS =====
    const mv = (item_id: string, movement_type: string, quantity: number, source_type: string, source_id: string | null, created_by: string) =>
      ({ item_id, movement_type, quantity, source_type, source_id, created_by, organization_id: ORG_ID });

    const movements = [
      // Received from closed/received POs
      mv(I(7), "received", 12, "purchase_order", PO(1), james),   // MIG wire from PO-001
      mv(I(13), "received", 5, "purchase_order", PO(1), james),   // Weld rod from PO-001
      mv(I(6), "received", 30, "purchase_order", PO(2), james),   // Steel plates from PO-002
      mv(I(2), "received", 2, "purchase_order", PO(7), sarah),    // Triplex pumps from PO-007
      mv(I(6), "received", 20, "purchase_order", PO(8), james),   // Steel plates from PO-008
      mv(I(12), "received", 2, "purchase_order", PO(11), james),  // Hydraulic fittings from PO-011
      // Historical stock received from closed POs (full audit trail)
      mv(I(3), "received", 20, "purchase_order", PO(13), sarah),   // Gate valves from PO-H01
      mv(I(4), "received", 15, "purchase_order", PO(13), sarah),   // Check valves from PO-H01
      mv(I(11), "received", 30, "purchase_order", PO(13), james),  // O-rings from PO-H01
      mv(I(5), "received", 8, "purchase_order", PO(14), sarah),    // Safety valves from PO-H02
      mv(I(8), "received", 15, "purchase_order", PO(15), james),   // Pump shafts from PO-H03
      mv(I(9), "received", 15, "purchase_order", PO(15), james),   // Impellers from PO-H03
      mv(I(10), "received", 15, "purchase_order", PO(15), james),  // Seal kits from PO-H03
      mv(I(20), "received", 100, "purchase_order", PO(16), maria), // Safety glasses from PO-H04
      mv(I(21), "received", 50, "purchase_order", PO(16), maria),  // Gloves from PO-H04
      mv(I(22), "received", 15, "purchase_order", PO(16), maria),  // Hard hats from PO-H04
      mv(I(23), "received", 60, "purchase_order", PO(17), maria),  // Paper towels from PO-H05
      mv(I(24), "received", 8, "purchase_order", PO(17), maria),   // Coffee from PO-H05
      mv(I(25), "received", 10, "purchase_order", PO(18), maria),  // Printer paper from PO-H06
      mv(I(14), "received", 20, "purchase_order", PO(19), james),  // Engine oil from PO-H07
      mv(I(15), "received", 12, "purchase_order", PO(19), james),  // Hydraulic fluid from PO-H07
      mv(I(16), "received", 10, "purchase_order", PO(19), james),  // Air filters from PO-H07
      mv(I(17), "received", 8, "purchase_order", PO(19), james),   // Brake pads from PO-H07
      mv(I(18), "received", 6, "purchase_order", PO(19), james),   // Trans filters from PO-H07
      mv(I(19), "received", 6, "purchase_order", PO(19), james),   // V-belts from PO-H07

      // Assembly production: +12 pump housings total
      mv(I(1), "assembled", 5, "assembly_record", AR(1), maria),
      mv(I(1), "assembled", 3, "assembly_record", AR(2), maria),
      mv(I(1), "assembled", 2, "assembly_record", AR(3), maria),
      mv(I(1), "assembled", 2, "assembly_record", AR(4), maria),

      // Assembly consumption: steel(24), shaft(12), impeller(12), seal(12)
      mv(I(6), "consumption", -10, "assembly_record", AR(1), maria),
      mv(I(8), "consumption", -5, "assembly_record", AR(1), maria),
      mv(I(9), "consumption", -5, "assembly_record", AR(1), maria),
      mv(I(10), "consumption", -5, "assembly_record", AR(1), maria),
      mv(I(6), "consumption", -6, "assembly_record", AR(2), maria),
      mv(I(8), "consumption", -3, "assembly_record", AR(2), maria),
      mv(I(9), "consumption", -3, "assembly_record", AR(2), maria),
      mv(I(10), "consumption", -3, "assembly_record", AR(2), maria),
      mv(I(6), "consumption", -4, "assembly_record", AR(3), maria),
      mv(I(8), "consumption", -2, "assembly_record", AR(3), maria),
      mv(I(9), "consumption", -2, "assembly_record", AR(3), maria),
      mv(I(10), "consumption", -2, "assembly_record", AR(3), maria),
      mv(I(6), "consumption", -4, "assembly_record", AR(4), maria),
      mv(I(8), "consumption", -2, "assembly_record", AR(4), maria),
      mv(I(9), "consumption", -2, "assembly_record", AR(4), maria),
      mv(I(10), "consumption", -2, "assembly_record", AR(4), maria),

      // Sales deductions (closed + fulfilled SOs)
      mv(I(1), "sale", -5, "sales_order", SO(1), dana),    // SO-001
      mv(I(3), "sale", -3, "sales_order", SO(2), dana),    // SO-002
      mv(I(4), "sale", -3, "sales_order", SO(2), dana),
      mv(I(1), "sale", -2, "sales_order", SO(2), dana),
      mv(I(3), "sale", -5, "sales_order", SO(4), dana),    // SO-004
      mv(I(4), "sale", -5, "sales_order", SO(4), dana),

      // Consumable usage
      mv(I(20), "consumption", -15, "manual", null, maria),
      mv(I(21), "consumption", -20, "manual", null, maria),
      mv(I(23), "consumption", -25, "manual", null, maria),
      mv(I(24), "consumption", -3, "manual", null, maria),

      // Reconciliation adjustments
      mv(I(7), "reconciliation", -2, "reconciliation", null, james),
      mv(I(1), "reconciliation", 1, "reconciliation", null, james),
      mv(I(20), "reconciliation", -5, "reconciliation", null, james),
    ];
    for (const m of movements) await sb.from("inventory_movements").insert(m);

    // ===== STEP 12: RECONCILIATIONS =====
    const recons = [
      { item_id: I(7), expected_quantity: 12, actual_quantity: 10, variance: -2, notes: "2 MIG wire spools unaccounted for — possible unreported shop usage", created_by: james, organization_id: ORG_ID },
      { item_id: I(1), expected_quantity: 4, actual_quantity: 5, variance: 1, notes: "Found 1 extra pump housing in back storage area", created_by: james, organization_id: ORG_ID },
      { item_id: I(20), expected_quantity: 85, actual_quantity: 80, variance: -5, notes: "Safety glasses distributed without logging", created_by: james, organization_id: ORG_ID },
      { item_id: I(9), expected_quantity: 3, actual_quantity: 3, variance: 0, notes: "Impeller casting count confirmed accurate", created_by: sarah, organization_id: ORG_ID },
    ];
    for (const r of recons) await sb.from("reconciliations").insert(r);

    // ===== SUMMARY =====
    const summary = {
      success: true,
      message: "Demo data seeded successfully",
      counts: {
        organization: 1, departments: departments.length, users: demoUsers.length,
        suppliers: suppliers.length, inventory_items: items.length, units: units.length,
        purchase_orders: poData.length, purchase_order_items: poItems.length,
        sales_orders: soData.length, sales_order_items: soItems.length,
        assembly_records: assemblies.length, assembly_components: asmComponents.length,
        inventory_movements: movements.length, reconciliations: recons.length,
      },
      demo_accounts: demoUsers.map(u => ({ email: u.email, password: u.password, roles: u.roles })),
    };

    return new Response(JSON.stringify(summary), {
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
