import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ComboBox, type ComboBoxOption } from "@/components/ComboBox";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subMonths, subQuarters, subYears } from "date-fns";
import { CalendarIcon, ShoppingCart, Package, DollarSign, BarChart3, ChevronDown, ChevronRight, Wrench, Bot } from "lucide-react";
import { useLocation } from "react-router-dom";
import { ReportAssistantPanel } from "@/components/ReportAssistantPanel";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

type ReportKey =
  | "spending_supplier"
  | "open_pos"
  | "pending_approvals"
  | "monthly_purchase_totals"
  | "quarterly_spending"
  | "purchase_history_item"
  | "inventory_valuation"
  | "reconciliation_history"
  | "inventory_performance"
  | "recommended_stock"
  | "inventory_loss"
  | "assembly_history"
  | "sales_by_item"
  | "margin_by_item"
  | "quarterly_revenue"
  | "sales_by_salesperson"
  | "margins_by_timeframe";

interface ReportDef {
  key: ReportKey;
  name: string;
  description: string;
  hasDateRange: boolean;
  accessRoles: string[];
}

const LOCAL_CATEGORIES = [
  { title: "Purchasing", icon: ShoppingCart, reports: ["Spending by Supplier", "Monthly Purchase Totals", "Quarterly Spending", "Open Orders", "Pending Approvals", "Purchase History by Item"] },
  { title: "Inventory", icon: Package, reports: ["Inventory Valuation", "Reconciliation History", "Inventory Performance by Item", "Recommended Stock Levels", "Inventory Loss Summary", "Assembly History"] },
  { title: "Sales", icon: DollarSign, reports: ["Sales by Item", "Margin by Item", "Quarterly Revenue", "Sales by Salesperson", "Margins by Timeframe"] }
];

const REPORT_KEY_MAP: Record<string, ReportKey> = {
  "Spending by Supplier": "spending_supplier",
  "Monthly Purchase Totals": "monthly_purchase_totals",
  "Quarterly Spending": "quarterly_spending",
  "Open Orders": "open_pos",
  "Pending Approvals": "pending_approvals",
  "Purchase History by Item": "purchase_history_item",
  "Inventory Valuation": "inventory_valuation",
  "Reconciliation History": "reconciliation_history",
  "Inventory Performance by Item": "inventory_performance",
  "Recommended Stock Levels": "recommended_stock",
  "Inventory Loss Summary": "inventory_loss",
  "Assembly History": "assembly_history",
  "Sales by Item": "sales_by_item",
  "Margin by Item": "margin_by_item",
  "Quarterly Revenue": "quarterly_revenue",
  "Sales by Salesperson": "sales_by_salesperson",
  "Margins by Timeframe": "margins_by_timeframe"
};

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
];

function marginColor(pct: number) {
  if (pct >= 20) return "text-green-600";
  if (pct >= 5) return "text-amber-600";
  return "text-destructive";
}

function DatePicker({ date, onChange, label }: { date: Date | undefined; onChange: (d: Date | undefined) => void; label: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("w-[150px] justify-start text-left font-normal", !date && "text-muted-foreground")}>
          <CalendarIcon className="h-3.5 w-3.5 mr-1" />
          {date ? format(date, "MMM d, yyyy") : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={onChange} initialFocus className="p-3 pointer-events-auto" />
      </PopoverContent>
    </Popover>
  );
}

// Custom report template type
interface CustomTemplate {
  id: string;
  name: string;
  description: string | null;
  chart_type: string;
  access_level: string;
  supports_date_range: boolean | null;
}

export default function Reports() {
  const { orgId, user, roles } = useAuth();
  const location = useLocation();
  const [selectedKey, setSelectedKey] = useState<ReportKey | null>(null);
  const [selectedCustomId, setSelectedCustomId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(endOfMonth(new Date()));
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedItemName, setSelectedItemName] = useState<string>("");
  const [marginGrouping, setMarginGrouping] = useState<"weekly" | "monthly" | "quarterly">("monthly");
  const [expandedAssemblyIds, setExpandedAssemblyIds] = useState<Set<string>>(new Set());
  const [showAssistant, setShowAssistant] = useState(false);

  // Fetch report templates from database
  const { data: templatesData } = useQuery({
    queryKey: ["report-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_templates")
        .select("*")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Build reportDef array from templates, preferring org overrides
  const allReports: ReportDef[] = useMemo(() => {
    if (!templatesData) return [];
    const overriddenSystemIds = new Set(
      templatesData
        .filter((t) => t.organization_id && (t as any).source_template_id)
        .map((t) => (t as any).source_template_id as string)
    );
    const effectiveTemplates = templatesData.filter(
      (t) => !(t.organization_id === null && overriddenSystemIds.has(t.id))
    );
    return effectiveTemplates
      .filter((t) => REPORT_KEY_MAP[t.name] !== undefined)
      .map((t) => ({
        key: REPORT_KEY_MAP[t.name],
        name: t.name,
        description: t.description ?? "",
        hasDateRange: t.supports_date_range ?? true,
        accessRoles: t.access_level === "admin" ? ["admin"] :
                     t.access_level === "finance" ? ["admin", "finance"] :
                     t.access_level === "sales" ? ["admin", "finance", "sales"] :
                     t.access_level === "procurement" ? ["admin", "finance", "procurement"] :
                     ["admin", t.access_level],
      }));
  }, [templatesData]);

  // Custom org templates (not matching any system report key)
  const customTemplates: CustomTemplate[] = useMemo(() => {
    if (!templatesData || !orgId) return [];
    return templatesData
      .filter((t) => t.organization_id === orgId && REPORT_KEY_MAP[t.name] === undefined)
      .map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        chart_type: t.chart_type,
        access_level: t.access_level,
        supports_date_range: t.supports_date_range,
      }));
  }, [templatesData, orgId]);

  // Build categories from LOCAL_CATEGORIES with DB-sourced reports
  const reportCategories = useMemo(() => {
    return LOCAL_CATEGORIES.map((cat) => ({
      title: cat.title,
      icon: cat.icon,
      reports: cat.reports
        .map((name) => allReports.find((r) => r.name === name))
        .filter((r): r is ReportDef => !!r),
    }));
  }, [allReports]);

  useEffect(() => {
    const state = location.state as any;
    if (state?.startDate) {
      setStartDate(new Date(state.startDate));
    }
    if (state?.endDate) {
      setEndDate(new Date(state.endDate));
    }
    if (state?.prefill?.report_name && allReports.length > 0) {
      const match = allReports.find((r) =>
        r.name.toLowerCase().includes(state.prefill.report_name.toLowerCase())
      );
      if (match) setSelectedKey(match.key);
    }
  }, [allReports]);

  const canAccessReport = (report: ReportDef) =>
    roles.includes("admin") || report.accessRoles.some((r) => roles.includes(r));
  const canAccessKey = (key: ReportKey) => {
    const r = allReports.find((rr) => rr.key === key);
    return r ? canAccessReport(r) : false;
  };

  const selected = allReports.find((r) => r.key === selectedKey) ?? null;
  const hasAccess = selected ? canAccessReport(selected) : false;
  const selectedCustom = customTemplates.find((t) => t.id === selectedCustomId) ?? null;

  const quickSelect = (start: Date, end: Date) => { setStartDate(start); setEndDate(end); };
  const now = new Date();

  // Build available reports list for the assistant
  const availableReportsForAssistant = useMemo(() => {
    const reports: { name: string; description: string; category: string }[] = [];
    for (const cat of LOCAL_CATEGORIES) {
      for (const reportName of cat.reports) {
        const r = allReports.find((ar) => ar.name === reportName);
        if (r && canAccessReport(r)) {
          reports.push({ name: r.name, description: r.description, category: cat.title });
        }
      }
    }
    for (const ct of customTemplates) {
      reports.push({ name: ct.name, description: ct.description || "", category: "Custom" });
    }
    return reports;
  }, [allReports, customTemplates, roles]);

  const handleAssistantSelectReport = useCallback((reportName: string, startDateStr?: string | null, endDateStr?: string | null) => {
    // Try built-in reports first
    const key = REPORT_KEY_MAP[reportName];
    if (key) {
      setSelectedKey(key);
      setSelectedCustomId(null);
    } else {
      // Try custom templates
      const custom = customTemplates.find((t) => t.name.toLowerCase() === reportName.toLowerCase());
      if (custom) {
        setSelectedCustomId(custom.id);
        setSelectedKey(null);
      }
    }
    // Set date range if provided
    if (startDateStr) setStartDate(new Date(startDateStr));
    if (endDateStr) setEndDate(new Date(endDateStr));
  }, [customTemplates]);

  // ---- Custom Report Execution ----
  const startISO = startDate?.toISOString();
  const endISO = endDate?.toISOString();

  const { data: customReportData, isLoading: loadingCustom, error: customError } = useQuery({
    queryKey: ["custom-report", selectedCustomId, startISO, endISO],
    enabled: !!selectedCustomId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("run-report", {
        body: {
          template_id: selectedCustomId,
          start_date: startISO,
          end_date: endISO,
          user_id: user!.id,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { columns: string[]; rows: Record<string, any>[] };
    },
  });

  // ---- Inline queries (unchanged) ----

  const { data: spendingData, isLoading: loadingSpending } = useQuery({
    queryKey: ["report-spending-supplier", orgId, startISO, endISO],
    enabled: selectedKey === "spending_supplier" && !!orgId && canAccessKey("spending_supplier"),
    queryFn: async () => {
      let q = supabase.from("purchase_orders").select("total_amount, suppliers!purchase_orders_supplier_id_fkey(name)").neq("status", "draft");
      if (startISO) q = q.gte("created_at", startISO);
      if (endISO) q = q.lte("created_at", endISO);
      const { data } = await q;
      const map: Record<string, number> = {};
      (data ?? []).forEach((po: any) => {
        const name = po.suppliers?.name ?? "Unknown";
        map[name] = (map[name] || 0) + Number(po.total_amount || 0);
      });
      return Object.entries(map).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
    },
  });

  const { data: openPOs, isLoading: loadingOpen } = useQuery({
    queryKey: ["report-open-pos", orgId],
    enabled: selectedKey === "open_pos" && !!orgId && canAccessKey("open_pos"),
    queryFn: async () => {
      const { data } = await supabase.from("purchase_orders")
        .select("po_number, status, total_amount, created_at, suppliers!purchase_orders_supplier_id_fkey(name), departments!purchase_orders_department_id_fkey(name)")
        .not("status", "in", "(closed,draft)")
        .order("status").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: pendingData, isLoading: loadingPending } = useQuery({
    queryKey: ["report-pending", orgId],
    enabled: selectedKey === "pending_approvals" && !!orgId && canAccessKey("pending_approvals"),
    queryFn: async () => {
      const { data } = await supabase.from("purchase_orders")
        .select("po_number, total_amount, created_at, suppliers!purchase_orders_supplier_id_fkey(name), departments!purchase_orders_department_id_fkey(name)")
        .eq("status", "submitted")
        .order("created_at");
      return (data ?? []).map((po: any) => ({
        ...po,
        daysPending: Math.floor((Date.now() - new Date(po.created_at).getTime()) / 86400000),
      }));
    },
  });

  const { data: valuationData, isLoading: loadingValuation } = useQuery({
    queryKey: ["report-valuation", orgId],
    enabled: selectedKey === "inventory_valuation" && !!orgId && canAccessKey("inventory_valuation"),
    queryFn: async () => {
      const { data: items } = await supabase.from("inventory_items").select("id, name, sku, item_type, default_unit_cost");
      if (!items || items.length === 0) return [];
      const { data: movements } = await supabase.from("inventory_movements").select("item_id, quantity");
      const qtyMap: Record<string, number> = {};
      (movements ?? []).forEach((m) => { qtyMap[m.item_id] = (qtyMap[m.item_id] || 0) + m.quantity; });
      return items.map((i) => ({
        ...i,
        onHand: qtyMap[i.id] || 0,
        totalValue: (qtyMap[i.id] || 0) * Number(i.default_unit_cost || 0),
      })).sort((a, b) => a.item_type.localeCompare(b.item_type));
    },
  });

  const { data: reconData, isLoading: loadingRecon } = useQuery({
    queryKey: ["report-recon", orgId, startISO, endISO],
    enabled: selectedKey === "reconciliation_history" && !!orgId && canAccessKey("reconciliation_history"),
    queryFn: async () => {
      let q = supabase.from("reconciliations").select("*, inventory_items!reconciliations_item_id_fkey(name)").order("created_at", { ascending: false });
      if (startISO) q = q.gte("created_at", startISO);
      if (endISO) q = q.lte("created_at", endISO);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: salesItemData, isLoading: loadingSales } = useQuery({
    queryKey: ["report-sales-item", orgId, user?.id, startISO, endISO],
    enabled: selectedKey === "sales_by_item" && !!orgId && !!user && canAccessKey("sales_by_item"),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_sales_by_item", {
        _user_id: user!.id,
        _start_date: startISO!,
        _end_date: endISO!,
      });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        name: r.item_name,
        units: Number(r.units_sold),
        revenue: Number(r.revenue),
      }));
    },
  });

  const { data: salesPersonData, isLoading: loadingSalesPerson } = useQuery({
    queryKey: ["report-sales-person", orgId, user?.id, startISO, endISO],
    enabled: selectedKey === "sales_by_salesperson" && !!orgId && !!user && canAccessKey("sales_by_salesperson"),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_sales_by_salesperson", {
        _user_id: user!.id,
        _start_date: startISO!,
        _end_date: endISO!,
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: monthlyPurchaseData, isLoading: loadingMonthly } = useQuery({
    queryKey: ["report-monthly-purchase", orgId, startISO, endISO],
    enabled: selectedKey === "monthly_purchase_totals" && !!orgId && canAccessKey("monthly_purchase_totals"),
    queryFn: async () => {
      let q = supabase.from("purchase_orders").select("total_amount, created_at").neq("status", "draft");
      if (startISO) q = q.gte("created_at", startISO);
      if (endISO) q = q.lte("created_at", endISO);
      const { data } = await q;
      const map: Record<string, number> = {};
      (data ?? []).forEach((po: any) => {
        const key = format(new Date(po.created_at), "MMM yyyy");
        map[key] = (map[key] || 0) + Number(po.total_amount || 0);
      });
      return Object.entries(map)
        .map(([month, total]) => ({ month, total }))
        .sort((a, b) => new Date("1 " + a.month).getTime() - new Date("1 " + b.month).getTime());
    },
  });

  const { data: quarterlySpendData, isLoading: loadingQtrSpend } = useQuery({
    queryKey: ["report-quarterly-spend", orgId, startISO, endISO],
    enabled: selectedKey === "quarterly_spending" && !!orgId && canAccessKey("quarterly_spending"),
    queryFn: async () => {
      let q = supabase.from("purchase_orders").select("total_amount, created_at").neq("status", "draft");
      if (startISO) q = q.gte("created_at", startISO);
      if (endISO) q = q.lte("created_at", endISO);
      const { data } = await q;
      const map: Record<string, number> = {};
      (data ?? []).forEach((po: any) => {
        const d = new Date(po.created_at);
        const qtr = Math.floor(d.getMonth() / 3) + 1;
        const key = `Q${qtr} ${d.getFullYear()}`;
        map[key] = (map[key] || 0) + Number(po.total_amount || 0);
      });
      return Object.entries(map).map(([quarter, total]) => ({ quarter, total }));
    },
  });

  const handleItemSearch = useCallback(async (query: string) => {
    const { data } = await supabase.from("inventory_items").select("id, name").ilike("name", `%${query}%`).limit(20);
    return (data ?? []).map((i) => ({ id: i.id, label: i.name }));
  }, []);

  const { data: purchaseHistoryData, isLoading: loadingPurchaseHistory } = useQuery({
    queryKey: ["report-purchase-history-item", orgId, selectedItemId, startISO, endISO],
    enabled: selectedKey === "purchase_history_item" && !!orgId && !!selectedItemId && canAccessKey("purchase_history_item"),
    queryFn: async () => {
      const { data } = await supabase
        .from("purchase_order_items")
        .select(`quantity, unit_cost, purchase_orders!inner(po_number, created_at, status, suppliers(name))`)
        .eq("item_id", selectedItemId!)
        .neq("purchase_orders.status", "draft");
      const rows = (data ?? []).map((li: any) => ({
        date: new Date(li.purchase_orders.created_at).toLocaleDateString(),
        po_number: li.purchase_orders.po_number,
        quantity: li.quantity,
        unit_cost: Number(li.unit_cost),
        supplier_name: li.purchase_orders.suppliers?.name ?? "—",
      }));
      const avgCost = rows.length ? rows.reduce((s, r) => s + r.unit_cost, 0) / rows.length : 0;
      return { rows, avgCost };
    },
  });

  const { data: inventoryPerfData, isLoading: loadingInvPerf } = useQuery({
    queryKey: ["report-inv-perf", orgId, startISO, endISO],
    enabled: selectedKey === "inventory_performance" && !!orgId && canAccessKey("inventory_performance"),
    queryFn: async () => {
      let q = supabase.from("inventory_movements")
        .select("item_id, quantity, created_at, inventory_items:item_id(name, item_type)")
        .order("created_at");
      if (startISO) q = q.gte("created_at", startISO);
      if (endISO) q = q.lte("created_at", endISO);
      const { data } = await q;
      const itemMap: Record<string, { name: string; movements: { date: string; qty: number }[] }> = {};
      (data ?? []).forEach((m: any) => {
        if (!m.inventory_items) return;
        if (!["resale", "manufacturing_input"].includes(m.inventory_items.item_type)) return;
        if (!itemMap[m.item_id]) {
          itemMap[m.item_id] = { name: m.inventory_items.name, movements: [] };
        }
        itemMap[m.item_id].movements.push({ date: format(new Date(m.created_at), "MMM d"), qty: m.quantity });
      });
      return Object.values(itemMap).map((item) => {
        let running = 0;
        return {
          name: item.name,
          totalVolume: item.movements.reduce((s, mv) => s + Math.abs(mv.qty), 0),
          points: item.movements.map((mv) => { running += mv.qty; return { date: mv.date, qty: running }; }),
        };
      });
    },
  });

  const { data: recommendedStockData, isLoading: loadingRecommended } = useQuery({
    queryKey: ["report-recommended-stock", orgId],
    enabled: selectedKey === "recommended_stock" && !!orgId && canAccessKey("recommended_stock"),
    queryFn: async () => {
      const { data: items } = await supabase
        .from("inventory_items")
        .select("id, name, sku, preferred_supplier_id, suppliers:preferred_supplier_id(name, avg_lead_time_days)")
        .in("item_type", ["resale", "manufacturing_input"]);
      const { data: movements } = await supabase.from("inventory_movements").select("item_id, quantity, movement_type, created_at");
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
      return (items ?? []).map((item: any) => {
        const itemMovements = (movements ?? []).filter((m) => m.item_id === item.id);
        const currentStock = itemMovements.reduce((s, m) => s + m.quantity, 0);
        const salesLast12 = itemMovements
          .filter((m) => m.movement_type === "sale" && new Date(m.created_at) >= twelveMonthsAgo)
          .reduce((s, m) => s + Math.abs(m.quantity), 0);
        const avgMonthlySales = salesLast12 / 12;
        const avgDailySales = avgMonthlySales / 30;
        const leadTime = item.suppliers?.avg_lead_time_days ?? 14;
        const reorderPoint = Math.ceil(avgDailySales * leadTime);
        const suggestedQty = Math.ceil(avgMonthlySales) || 1;
        return { id: item.id, name: item.name, sku: item.sku, supplier: item.suppliers?.name ?? "—", currentStock, reorderPoint, suggestedQty, leadTime };
      }).filter((i) => i.currentStock <= i.reorderPoint);
    },
  });

  const { data: inventoryLossData, isLoading: loadingLoss } = useQuery({
    queryKey: ["report-inv-loss", orgId, startISO, endISO],
    enabled: selectedKey === "inventory_loss" && !!orgId && canAccessKey("inventory_loss"),
    queryFn: async () => {
      let q = supabase.from("reconciliations")
        .select("item_id, variance, inventory_items:item_id(name, default_unit_cost)")
        .lt("variance", 0);
      if (startISO) q = q.gte("created_at", startISO);
      if (endISO) q = q.lte("created_at", endISO);
      const { data } = await q;
      const map: Record<string, any> = {};
      (data ?? []).forEach((r: any) => {
        const id = r.item_id;
        if (!map[id]) map[id] = { name: r.inventory_items?.name ?? "—", cost: Number(r.inventory_items?.default_unit_cost || 0), totalLoss: 0 };
        map[id].totalLoss += Math.abs(r.variance);
      });
      return Object.values(map).map((i: any) => ({ ...i, estimatedValue: i.totalLoss * i.cost })).sort((a: any, b: any) => b.estimatedValue - a.estimatedValue);
    },
  });

  const { data: assemblyHistData, isLoading: loadingAssembly } = useQuery({
    queryKey: ["report-assembly-history", orgId, startISO, endISO],
    enabled: selectedKey === "assembly_history" && !!orgId && canAccessKey("assembly_history"),
    queryFn: async () => {
      let q = supabase.from("assembly_records")
        .select("id, quantity_produced, created_at, inventory_items:finished_item_id(name)")
        .order("created_at", { ascending: false });
      if (startISO) q = q.gte("created_at", startISO);
      if (endISO) q = q.lte("created_at", endISO);
      const { data: records } = await q;
      if (!records || records.length === 0) return [];
      const ids = records.map((r: any) => r.id);
      const { data: components } = await supabase
        .from("assembly_record_components")
        .select("assembly_record_id, quantity_consumed, inventory_items:component_item_id(name)")
        .in("assembly_record_id", ids);
      return records.map((r: any) => ({
        id: r.id,
        date: new Date(r.created_at).toLocaleDateString(),
        finishedItem: r.inventory_items?.name ?? "—",
        qtyProduced: r.quantity_produced,
        components: (components ?? [])
          .filter((c: any) => c.assembly_record_id === r.id)
          .map((c: any) => ({ name: c.inventory_items?.name ?? "—", qtyConsumed: c.quantity_consumed })),
      }));
    },
  });

  const { data: marginItemData, isLoading: loadingMarginItem } = useQuery({
    queryKey: ["report-margin-item", orgId, user?.id, startISO, endISO],
    enabled: selectedKey === "margin_by_item" && !!orgId && !!user && canAccessKey("margin_by_item"),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_margin_by_item", {
        _user_id: user!.id,
        _start_date: startISO!,
        _end_date: endISO!,
      });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        name: r.item_name,
        units: Number(r.units_sold),
        revenue: Number(r.revenue),
        cogs: Number(r.cogs),
        grossMargin: Number(r.gross_margin),
        marginPct: Number(r.margin_pct),
      }));
    },
  });

  const { data: quarterlyRevData, isLoading: loadingQtrRev } = useQuery({
    queryKey: ["report-quarterly-rev", orgId, user?.id, startISO, endISO],
    enabled: selectedKey === "quarterly_revenue" && !!orgId && !!user && canAccessKey("quarterly_revenue"),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_quarterly_revenue", {
        _user_id: user!.id,
        _start_date: startISO!,
        _end_date: endISO!,
      });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        quarter: r.quarter,
        total: Number(r.total),
      }));
    },
  });

  const { data: marginTimeData, isLoading: loadingMarginTime } = useQuery({
    queryKey: ["report-margin-time", orgId, user?.id, startISO, endISO, marginGrouping],
    enabled: selectedKey === "margins_by_timeframe" && !!orgId && !!user && canAccessKey("margins_by_timeframe"),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_margins_by_timeframe", {
        _user_id: user!.id,
        _start_date: startISO!,
        _end_date: endISO!,
        _grouping: marginGrouping,
      });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        period: r.period,
        revenue: Number(r.revenue),
        cogs: Number(r.cogs),
        grossMargin: Number(r.gross_margin),
        marginPct: Number(r.margin_pct),
      }));
    },
  });

  const isSalesOnly = roles.includes("sales") && !roles.includes("admin") && !roles.includes("finance");

  const isLoading =
    selectedCustomId ? loadingCustom :
    selectedKey === "spending_supplier" ? loadingSpending
    : selectedKey === "monthly_purchase_totals" ? loadingMonthly
    : selectedKey === "quarterly_spending" ? loadingQtrSpend
    : selectedKey === "open_pos" ? loadingOpen
    : selectedKey === "pending_approvals" ? loadingPending
    : selectedKey === "purchase_history_item" ? loadingPurchaseHistory
    : selectedKey === "inventory_valuation" ? loadingValuation
    : selectedKey === "reconciliation_history" ? loadingRecon
    : selectedKey === "inventory_performance" ? loadingInvPerf
    : selectedKey === "recommended_stock" ? loadingRecommended
    : selectedKey === "inventory_loss" ? loadingLoss
    : selectedKey === "assembly_history" ? loadingAssembly
    : selectedKey === "sales_by_item" ? loadingSales
    : selectedKey === "margin_by_item" ? loadingMarginItem
    : selectedKey === "quarterly_revenue" ? loadingQtrRev
    : selectedKey === "sales_by_salesperson" ? loadingSalesPerson
    : selectedKey === "margins_by_timeframe" ? loadingMarginTime
    : false;

  const toggleAssemblyExpand = (id: string) => {
    setExpandedAssemblyIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const perfChartItems = useMemo(() => {
    if (!inventoryPerfData) return { dates: [] as string[], items: [] as { name: string; points: { date: string; qty: number }[] }[] };
    const sorted = [...inventoryPerfData].sort((a, b) => b.totalVolume - a.totalVolume).slice(0, 8);
    const allDates = Array.from(new Set(sorted.flatMap((i) => i.points.map((p) => p.date))));
    return { dates: allDates, items: sorted };
  }, [inventoryPerfData]);

  // Helper to detect numeric columns for charting
  const getNumericColumns = (columns: string[], rows: Record<string, any>[]) => {
    if (rows.length === 0) return [];
    return columns.filter((col) => {
      const val = rows[0][col];
      return typeof val === "number" || (typeof val === "string" && !isNaN(Number(val)) && val.trim() !== "");
    });
  };

  return (
    <div>
      <PageHeader title="Reports" description="Data-driven insights from your operations">
        <Button
          variant={showAssistant ? "default" : "outline"}
          size="sm"
          onClick={() => setShowAssistant((v) => !v)}
          className="gap-2"
        >
          <Bot className="h-4 w-4" />
          {showAssistant ? "Hide Assistant" : "Report Assistant"}
        </Button>
      </PageHeader>
      <div className="flex p-8 gap-6">
        {/* Main content area */}
        <div className="flex gap-6 flex-1 min-w-0 max-w-7xl">
        {/* Left — Report Selector */}
        <div className="w-64 shrink-0 space-y-6">
          {reportCategories.map((cat) => {
            const accessible = cat.reports.filter(canAccessReport);
            if (accessible.length === 0) return null;
            return (
              <div key={cat.title}>
                <div className="flex items-center gap-2 mb-2">
                  <cat.icon className="h-4 w-4 text-primary" />
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{cat.title}</h3>
                </div>
                <div className="space-y-1">
                  {accessible.map((r) => (
                    <button
                      key={r.key}
                      onClick={() => { setSelectedKey(r.key); setSelectedCustomId(null); }}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm rounded-md transition-colors",
                        selectedKey === r.key && !selectedCustomId ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted"
                      )}
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Custom Reports section */}
          {customTemplates.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Wrench className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Custom Reports</h3>
              </div>
              <div className="space-y-1">
                {customTemplates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setSelectedCustomId(t.id); setSelectedKey(null); }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center gap-2",
                      selectedCustomId === t.id ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted"
                    )}
                  >
                    <Wrench className="h-3 w-3 flex-shrink-0 opacity-50" />
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right — Report Display */}
        <div className="flex-1 min-w-0">
          {/* Custom report view */}
          {selectedCustomId && selectedCustom ? (
            <div className="space-y-4">
              <div className="fieldcore-card p-4">
                <h2 className="text-lg font-semibold text-foreground">{selectedCustom.name}</h2>
                {selectedCustom.description && <p className="text-sm text-muted-foreground">{selectedCustom.description}</p>}
                {selectedCustom.supports_date_range && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <DatePicker date={startDate} onChange={setStartDate} label="Start date" />
                    <span className="text-muted-foreground text-xs">to</span>
                    <DatePicker date={endDate} onChange={setEndDate} label="End date" />
                    <div className="flex gap-1 ml-2 flex-wrap">
                      <Button variant="ghost" size="sm" onClick={() => quickSelect(startOfMonth(now), endOfMonth(now))}>This Month</Button>
                      <Button variant="ghost" size="sm" onClick={() => quickSelect(startOfMonth(subMonths(now, 1)), endOfMonth(subMonths(now, 1)))}>Last Month</Button>
                      <Button variant="ghost" size="sm" onClick={() => quickSelect(startOfQuarter(now), endOfQuarter(now))}>This Quarter</Button>
                      <Button variant="ghost" size="sm" onClick={() => quickSelect(startOfYear(now), endOfYear(now))}>This Year</Button>
                    </div>
                  </div>
                )}
              </div>

              {loadingCustom ? (
                <div className="fieldcore-card p-12 text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : customError ? (
                <div className="fieldcore-card p-8 text-center">
                  <p className="text-sm text-destructive font-medium">{(customError as Error).message}</p>
                  {(customError as Error).message?.includes("no query configured") && (
                    <p className="text-xs text-muted-foreground mt-2">
                      This report has no query configured yet. Edit it in Settings → Report Templates to add a SQL query.
                    </p>
                  )}
                </div>
              ) : customReportData ? (
                <div className="fieldcore-card overflow-hidden">
                  {customReportData.rows.length === 0 ? <NoData /> : (
                    <div>
                      {/* Chart rendering for bar/line */}
                      {(selectedCustom.chart_type === "bar" || selectedCustom.chart_type === "line") && customReportData.rows.length > 0 && (() => {
                        const numCols = getNumericColumns(customReportData.columns, customReportData.rows);
                        const labelCol = customReportData.columns.find((c) => !numCols.includes(c)) || customReportData.columns[0];
                        if (numCols.length === 0) return null;
                        const ChartComp = selectedCustom.chart_type === "bar" ? BarChart : LineChart;
                        return (
                          <div className="p-4">
                            <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                <ChartComp data={customReportData.rows.map((r) => {
                                  const row: any = { ...r };
                                  numCols.forEach((c) => { row[c] = Number(row[c]); });
                                  return row;
                                })}>
                                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                  <XAxis dataKey={labelCol} tick={{ fontSize: 11 }} className="text-muted-foreground" />
                                  <YAxis tick={{ fontSize: 12 }} />
                                  <Tooltip />
                                  <Legend />
                                  {numCols.map((col, idx) =>
                                    selectedCustom.chart_type === "bar" ? (
                                      <Bar key={col} dataKey={col} fill={CHART_COLORS[idx % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
                                    ) : (
                                      <Line key={col} type="monotone" dataKey={col} stroke={CHART_COLORS[idx % CHART_COLORS.length]} strokeWidth={2} dot={false} />
                                    )
                                  )}
                                </ChartComp>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        );
                      })()}
                      {/* Table rendering */}
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            {customReportData.columns.map((col) => (
                              <th key={col} className="px-4 py-2 text-left font-medium text-muted-foreground">{col.replace(/_/g, " ")}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {customReportData.rows.map((row, i) => (
                            <tr key={i}>
                              {customReportData.columns.map((col) => {
                                const val = row[col];
                                const isNum = typeof val === "number" || (typeof val === "string" && !isNaN(Number(val)) && val.trim() !== "");
                                return (
                                  <td key={col} className={cn("px-4 py-2 text-foreground", isNum && "text-right")}>
                                    {isNum ? Number(val).toLocaleString() : String(val ?? "—")}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : !selected ? (
            <div className="fieldcore-card p-12 text-center text-muted-foreground">
              <BarChart3 className="mx-auto h-10 w-10 mb-3 opacity-40" />
              <p>Select a report from the left panel</p>
            </div>
          ) : !hasAccess ? (
            <div className="fieldcore-card p-12 text-center text-muted-foreground">
              <BarChart3 className="mx-auto h-10 w-10 mb-3 opacity-40" />
              <p className="font-medium text-foreground">Access Denied</p>
              <p className="text-sm mt-1">You do not have permission to view this report.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="fieldcore-card p-4">
                <h2 className="text-lg font-semibold text-foreground">{selected.name}</h2>
                <p className="text-sm text-muted-foreground">{selected.description}</p>

                {selectedKey === "purchase_history_item" && (
                  <div className="mt-3 max-w-sm">
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Select Item</label>
                    <ComboBox
                      value={selectedItemId ? { id: selectedItemId, label: selectedItemName } : null}
                      onChange={(v) => { setSelectedItemId(v?.id ?? null); setSelectedItemName(v?.label ?? ""); }}
                      onSearch={handleItemSearch}
                      placeholder="Search items..."
                    />
                  </div>
                )}

                {selectedKey === "margins_by_timeframe" && (
                  <div className="mt-3 flex items-center gap-1">
                    <span className="text-xs font-medium text-muted-foreground mr-2">Group by:</span>
                    {(["weekly", "monthly", "quarterly"] as const).map((g) => (
                      <Button key={g} variant={marginGrouping === g ? "default" : "outline"} size="sm" onClick={() => setMarginGrouping(g)} className="capitalize text-xs">
                        {g}
                      </Button>
                    ))}
                  </div>
                )}

                {selected.hasDateRange && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <DatePicker date={startDate} onChange={setStartDate} label="Start date" />
                    <span className="text-muted-foreground text-xs">to</span>
                    <DatePicker date={endDate} onChange={setEndDate} label="End date" />
                    <div className="flex gap-1 ml-2 flex-wrap">
                      <Button variant="ghost" size="sm" onClick={() => quickSelect(startOfMonth(now), endOfMonth(now))}>This Month</Button>
                      <Button variant="ghost" size="sm" onClick={() => quickSelect(startOfMonth(subMonths(now, 1)), endOfMonth(subMonths(now, 1)))}>Last Month</Button>
                      <Button variant="ghost" size="sm" onClick={() => quickSelect(startOfQuarter(now), endOfQuarter(now))}>This Quarter</Button>
                      <Button variant="ghost" size="sm" onClick={() => quickSelect(startOfQuarter(subQuarters(now, 1)), endOfQuarter(subQuarters(now, 1)))}>Last Quarter</Button>
                      <Button variant="ghost" size="sm" onClick={() => quickSelect(startOfYear(now), endOfYear(now))}>This Year</Button>
                      <Button variant="ghost" size="sm" onClick={() => quickSelect(startOfYear(subYears(now, 1)), endOfYear(subYears(now, 1)))}>Last Year</Button>
                      <span className="text-muted-foreground text-xs self-center mx-1">|</span>
                      {[1, 2, 3, 4].map((q) => {
                        const qStart = new Date(now.getFullYear(), (q - 1) * 3, 1);
                        const qEnd = endOfMonth(new Date(now.getFullYear(), q * 3 - 1, 1));
                        return (
                          <Button key={q} variant="ghost" size="sm" onClick={() => quickSelect(qStart, qEnd)}>
                            Q{q} {now.getFullYear()}
                          </Button>
                        );
                      })}
                      {[1, 2, 3, 4].map((q) => {
                        const prevYear = now.getFullYear() - 1;
                        const qStart = new Date(prevYear, (q - 1) * 3, 1);
                        const qEnd = endOfMonth(new Date(prevYear, q * 3 - 1, 1));
                        return (
                          <Button key={`prev-${q}`} variant="ghost" size="sm" onClick={() => quickSelect(qStart, qEnd)}>
                            Q{q} {prevYear}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {isLoading ? (
                <div className="fieldcore-card p-12 text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : (
                <div className="fieldcore-card overflow-hidden">
                  {/* Spending by Supplier */}
                  {selectedKey === "spending_supplier" && (
                    <>
                      {(!spendingData || spendingData.length === 0) ? <NoData /> : (
                        <div className="p-4 space-y-4">
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={spendingData}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v.toLocaleString()}`} />
                                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                          <table className="w-full text-sm">
                            <thead><tr className="border-b bg-muted/50"><th className="px-4 py-2 text-left font-medium text-muted-foreground">Supplier</th><th className="px-4 py-2 text-right font-medium text-muted-foreground">Total Spend</th></tr></thead>
                            <tbody className="divide-y">
                              {spendingData.map((r) => (
                                <tr key={r.name}><td className="px-4 py-2 text-foreground">{r.name}</td><td className="px-4 py-2 text-right font-medium text-foreground">${r.total.toLocaleString()}</td></tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}

                  {/* Open POs */}
                  {selectedKey === "open_pos" && (
                    <>
                      {(!openPOs || openPOs.length === 0) ? <NoData /> : (
                        <table className="w-full text-sm">
                          <thead><tr className="border-b bg-muted/50 text-left">
                            <th className="px-4 py-2 font-medium text-muted-foreground">PO #</th>
                            <th className="px-4 py-2 font-medium text-muted-foreground">Supplier</th>
                            <th className="px-4 py-2 font-medium text-muted-foreground">Department</th>
                            <th className="px-4 py-2 font-medium text-muted-foreground">Status</th>
                            <th className="px-4 py-2 font-medium text-muted-foreground text-right">Amount</th>
                            <th className="px-4 py-2 font-medium text-muted-foreground">Date</th>
                          </tr></thead>
                          <tbody className="divide-y">
                            {openPOs.map((po: any) => (
                              <tr key={po.po_number}>
                                <td className="px-4 py-2 font-medium text-foreground">{po.po_number}</td>
                                <td className="px-4 py-2 text-foreground">{po.suppliers?.name ?? "—"}</td>
                                <td className="px-4 py-2 text-muted-foreground">{po.departments?.name ?? "—"}</td>
                                <td className="px-4 py-2 capitalize text-foreground">{po.status}</td>
                                <td className="px-4 py-2 text-right text-foreground">${Number(po.total_amount).toLocaleString()}</td>
                                <td className="px-4 py-2 text-muted-foreground">{new Date(po.created_at).toLocaleDateString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </>
                  )}

                  {/* Pending Approvals */}
                  {selectedKey === "pending_approvals" && (
                    <>
                      {(!pendingData || pendingData.length === 0) ? <NoData /> : (
                        <table className="w-full text-sm">
                          <thead><tr className="border-b bg-muted/50 text-left">
                            <th className="px-4 py-2 font-medium text-muted-foreground">PO #</th>
                            <th className="px-4 py-2 font-medium text-muted-foreground">Supplier</th>
                            <th className="px-4 py-2 font-medium text-muted-foreground">Department</th>
                            <th className="px-4 py-2 font-medium text-muted-foreground text-right">Amount</th>
                            <th className="px-4 py-2 font-medium text-muted-foreground text-right">Days Pending</th>
                          </tr></thead>
                          <tbody className="divide-y">
                            {pendingData.map((po: any) => (
                              <tr key={po.po_number}>
                                <td className="px-4 py-2 font-medium text-foreground">{po.po_number}</td>
                                <td className="px-4 py-2 text-foreground">{po.suppliers?.name ?? "—"}</td>
                                <td className="px-4 py-2 text-muted-foreground">{po.departments?.name ?? "—"}</td>
                                <td className="px-4 py-2 text-right text-foreground">${Number(po.total_amount).toLocaleString()}</td>
                                <td className="px-4 py-2 text-right font-medium text-foreground">{po.daysPending}d</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </>
                  )}

                  {/* Inventory Valuation */}
                  {selectedKey === "inventory_valuation" && (
                    <>
                      {(!valuationData || valuationData.length === 0) ? <NoData /> : (
                        <div>
                          <table className="w-full text-sm">
                            <thead><tr className="border-b bg-muted/50 text-left">
                              <th className="px-4 py-2 font-medium text-muted-foreground">Item</th>
                              <th className="px-4 py-2 font-medium text-muted-foreground">SKU</th>
                              <th className="px-4 py-2 font-medium text-muted-foreground">Type</th>
                              <th className="px-4 py-2 font-medium text-muted-foreground text-right">On Hand</th>
                              <th className="px-4 py-2 font-medium text-muted-foreground text-right">Unit Cost</th>
                              <th className="px-4 py-2 font-medium text-muted-foreground text-right">Total Value</th>
                            </tr></thead>
                            <tbody className="divide-y">
                              {valuationData.map((i: any) => (
                                <tr key={i.id}>
                                  <td className="px-4 py-2 font-medium text-foreground">{i.name}</td>
                                  <td className="px-4 py-2 text-muted-foreground">{i.sku ?? "—"}</td>
                                  <td className="px-4 py-2 text-muted-foreground capitalize">{i.item_type.replace("_", " ")}</td>
                                  <td className="px-4 py-2 text-right text-foreground">{i.onHand}</td>
                                  <td className="px-4 py-2 text-right text-foreground">${Number(i.default_unit_cost || 0).toFixed(2)}</td>
                                  <td className="px-4 py-2 text-right font-medium text-foreground">${i.totalValue.toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="border-t bg-muted/30">
                                <td colSpan={5} className="px-4 py-2 font-semibold text-foreground text-right">Total</td>
                                <td className="px-4 py-2 text-right font-semibold text-foreground">
                                  ${valuationData.reduce((s: number, i: any) => s + i.totalValue, 0).toLocaleString()}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </>
                  )}

                  {/* Reconciliation History */}
                  {selectedKey === "reconciliation_history" && (
                    <>
                      {(!reconData || reconData.length === 0) ? <NoData /> : (
                        <table className="w-full text-sm">
                          <thead><tr className="border-b bg-muted/50 text-left">
                            <th className="px-4 py-2 font-medium text-muted-foreground">Date</th>
                            <th className="px-4 py-2 font-medium text-muted-foreground">Item</th>
                            <th className="px-4 py-2 font-medium text-muted-foreground text-right">Expected</th>
                            <th className="px-4 py-2 font-medium text-muted-foreground text-right">Actual</th>
                            <th className="px-4 py-2 font-medium text-muted-foreground text-right">Variance</th>
                            <th className="px-4 py-2 font-medium text-muted-foreground">Notes</th>
                          </tr></thead>
                          <tbody className="divide-y">
                            {reconData.map((r: any) => (
                              <tr key={r.id}>
                                <td className="px-4 py-2 text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                                <td className="px-4 py-2 text-foreground">{r.inventory_items?.name ?? "—"}</td>
                                <td className="px-4 py-2 text-right text-foreground">{r.expected_quantity}</td>
                                <td className="px-4 py-2 text-right text-foreground">{r.actual_quantity}</td>
                                <td className={cn("px-4 py-2 text-right font-medium", r.variance < 0 ? "text-destructive" : r.variance > 0 ? "text-green-600" : "text-muted-foreground")}>
                                  {r.variance > 0 ? "+" : ""}{r.variance}
                                </td>
                                <td className="px-4 py-2 text-muted-foreground max-w-[200px] truncate">{r.notes ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </>
                  )}

                  {/* Sales by Item */}
                  {selectedKey === "sales_by_item" && (
                    <>
                      {(!salesItemData || salesItemData.length === 0) ? <NoData /> : (
                        <table className="w-full text-sm">
                          <thead><tr className="border-b bg-muted/50 text-left">
                            <th className="px-4 py-2 font-medium text-muted-foreground">Item</th>
                            <th className="px-4 py-2 font-medium text-muted-foreground text-right">Units Sold</th>
                            <th className="px-4 py-2 font-medium text-muted-foreground text-right">Total Revenue</th>
                          </tr></thead>
                          <tbody className="divide-y">
                            {salesItemData.map((r: any) => (
                              <tr key={r.name}>
                                <td className="px-4 py-2 font-medium text-foreground">{r.name}</td>
                                <td className="px-4 py-2 text-right text-foreground">{r.units}</td>
                                <td className="px-4 py-2 text-right font-medium text-foreground">${r.revenue.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </>
                  )}

                  {/* Sales by Salesperson */}
                  {selectedKey === "sales_by_salesperson" && (
                    <>
                      {(!salesPersonData || salesPersonData.length === 0) ? <NoData /> : (
                        <div className="p-4 space-y-4">
                          {isSalesOnly && (
                            <p className="text-sm text-muted-foreground italic">Showing your performance only.</p>
                          )}
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={salesPersonData}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis dataKey="salesperson_name" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v.toLocaleString()}`} />
                                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                                <Bar dataKey="total_revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                          <table className="w-full text-sm">
                            <thead><tr className="border-b bg-muted/50 text-left">
                              <th className="px-4 py-2 font-medium text-muted-foreground">Salesperson</th>
                              <th className="px-4 py-2 font-medium text-muted-foreground text-right">Orders</th>
                              <th className="px-4 py-2 font-medium text-muted-foreground text-right">Total Revenue</th>
                            </tr></thead>
                            <tbody className="divide-y">
                              {salesPersonData.map((r: any) => (
                                <tr key={r.salesperson_name}>
                                  <td className="px-4 py-2 font-medium text-foreground">{r.salesperson_name}</td>
                                  <td className="px-4 py-2 text-right text-foreground">{r.order_count}</td>
                                  <td className="px-4 py-2 text-right font-medium text-foreground">${Number(r.total_revenue).toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}

                  {/* Monthly Purchase Totals */}
                  {selectedKey === "monthly_purchase_totals" && (
                    <>
                      {(!monthlyPurchaseData || monthlyPurchaseData.length === 0) ? <NoData /> : (
                        <div className="p-4 space-y-4">
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={monthlyPurchaseData}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis dataKey="month" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v.toLocaleString()}`} />
                                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                          <table className="w-full text-sm">
                            <thead><tr className="border-b bg-muted/50"><th className="px-4 py-2 text-left font-medium text-muted-foreground">Month</th><th className="px-4 py-2 text-right font-medium text-muted-foreground">Total Spend</th></tr></thead>
                            <tbody className="divide-y">
                              {monthlyPurchaseData.map((r) => (
                                <tr key={r.month}><td className="px-4 py-2 text-foreground">{r.month}</td><td className="px-4 py-2 text-right font-medium text-foreground">${r.total.toLocaleString()}</td></tr>
                              ))}
                            </tbody>
                            <tfoot><tr className="border-t bg-muted/30"><td className="px-4 py-2 font-semibold text-foreground">Grand Total</td><td className="px-4 py-2 text-right font-semibold text-foreground">${monthlyPurchaseData.reduce((s, r) => s + r.total, 0).toLocaleString()}</td></tr></tfoot>
                          </table>
                        </div>
                      )}
                    </>
                  )}

                  {/* Quarterly Spending */}
                  {selectedKey === "quarterly_spending" && (
                    <>
                      {(!quarterlySpendData || quarterlySpendData.length === 0) ? <NoData /> : (
                        <div className="p-4 space-y-4">
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={quarterlySpendData}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis dataKey="quarter" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v.toLocaleString()}`} />
                                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                          <table className="w-full text-sm">
                            <thead><tr className="border-b bg-muted/50"><th className="px-4 py-2 text-left font-medium text-muted-foreground">Quarter</th><th className="px-4 py-2 text-right font-medium text-muted-foreground">Total Spend</th></tr></thead>
                            <tbody className="divide-y">
                              {quarterlySpendData.map((r) => (
                                <tr key={r.quarter}><td className="px-4 py-2 text-foreground">{r.quarter}</td><td className="px-4 py-2 text-right font-medium text-foreground">${r.total.toLocaleString()}</td></tr>
                              ))}
                            </tbody>
                            <tfoot><tr className="border-t bg-muted/30"><td className="px-4 py-2 font-semibold text-foreground">Grand Total</td><td className="px-4 py-2 text-right font-semibold text-foreground">${quarterlySpendData.reduce((s, r) => s + r.total, 0).toLocaleString()}</td></tr></tfoot>
                          </table>
                        </div>
                      )}
                    </>
                  )}

                  {/* Purchase History by Item */}
                  {selectedKey === "purchase_history_item" && (
                    <>
                      {!selectedItemId ? (
                        <div className="p-8 text-center text-muted-foreground">Select an item above to view its purchase history.</div>
                      ) : (!purchaseHistoryData || purchaseHistoryData.rows.length === 0) ? <NoData /> : (
                        <div className="p-4 space-y-4">
                          <p className="text-sm font-medium text-foreground">Avg Unit Cost: <span className="text-primary">${purchaseHistoryData.avgCost.toFixed(2)}</span></p>
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={purchaseHistoryData.rows}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis dataKey="date" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                                <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
                                <Line type="monotone" dataKey="unit_cost" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                          <table className="w-full text-sm">
                            <thead><tr className="border-b bg-muted/50 text-left">
                              <th className="px-4 py-2 font-medium text-muted-foreground">Date</th>
                              <th className="px-4 py-2 font-medium text-muted-foreground">PO #</th>
                              <th className="px-4 py-2 font-medium text-muted-foreground">Supplier</th>
                              <th className="px-4 py-2 font-medium text-muted-foreground text-right">Qty</th>
                              <th className="px-4 py-2 font-medium text-muted-foreground text-right">Unit Cost</th>
                            </tr></thead>
                            <tbody className="divide-y">
                              {purchaseHistoryData.rows.map((r, i) => (
                                <tr key={i}>
                                  <td className="px-4 py-2 text-muted-foreground">{r.date}</td>
                                  <td className="px-4 py-2 font-medium text-foreground">{r.po_number}</td>
                                  <td className="px-4 py-2 text-foreground">{r.supplier_name}</td>
                                  <td className="px-4 py-2 text-right text-foreground">{r.quantity}</td>
                                  <td className="px-4 py-2 text-right font-medium text-foreground">${r.unit_cost.toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}

                  {/* Inventory Performance */}
                  {selectedKey === "inventory_performance" && (
                    <>
                      {(!inventoryPerfData || inventoryPerfData.length === 0) ? <NoData /> : (
                        <div className="p-4 space-y-4">
                          <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis dataKey="date" type="category" allowDuplicatedCategory={false} tick={{ fontSize: 11 }} className="text-muted-foreground" />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip />
                                <Legend />
                                {perfChartItems.items.map((item, idx) => (
                                  <Line key={item.name} data={item.points} type="monotone" dataKey="qty" name={item.name} stroke={CHART_COLORS[idx % CHART_COLORS.length]} strokeWidth={2} dot={false} />
                                ))}
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                          <table className="w-full text-sm">
                            <thead><tr className="border-b bg-muted/50 text-left">
                              <th className="px-4 py-2 font-medium text-muted-foreground">Item</th>
                              <th className="px-4 py-2 font-medium text-muted-foreground text-right">Net Change</th>
                            </tr></thead>
                            <tbody className="divide-y">
                              {inventoryPerfData.map((item) => {
                                const net = item.points.length ? item.points[item.points.length - 1].qty : 0;
                                return (
                                  <tr key={item.name}>
                                    <td className="px-4 py-2 text-foreground">{item.name}</td>
                                    <td className={cn("px-4 py-2 text-right font-medium", net < 0 ? "text-destructive" : "text-foreground")}>{net > 0 ? "+" : ""}{net}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}

                  {/* Recommended Stock Levels */}
                  {selectedKey === "recommended_stock" && (
                    <>
                      {(!recommendedStockData || recommendedStockData.length === 0) ? (
                        <div className="p-8 text-center text-muted-foreground">All items are above their reorder points.</div>
                      ) : (
                        <div>
                          <table className="w-full text-sm">
                            <thead><tr className="border-b bg-muted/50 text-left">
                              <th className="px-4 py-2 font-medium text-muted-foreground">Item</th>
                              <th className="px-4 py-2 font-medium text-muted-foreground">SKU</th>
                              <th className="px-4 py-2 font-medium text-muted-foreground">Supplier</th>
                              <th className="px-4 py-2 font-medium text-muted-foreground text-right">Current Stock</th>
                              <th className="px-4 py-2 font-medium text-muted-foreground text-right">Reorder Point</th>
                              <th className="px-4 py-2 font-medium text-muted-foreground text-right">Suggested Order Qty</th>
                              <th className="px-4 py-2 font-medium text-muted-foreground text-right">Lead Time (days)</th>
                            </tr></thead>
                            <tbody className="divide-y">
                              {recommendedStockData.map((i: any) => (
                                <tr key={i.id}>
                                  <td className="px-4 py-2 font-medium text-foreground">{i.name}</td>
                                  <td className="px-4 py-2 text-muted-foreground">{i.sku ?? "—"}</td>
                                  <td className="px-4 py-2 text-foreground">{i.supplier}</td>
                                  <td className={cn("px-4 py-2 text-right font-medium", i.currentStock <= i.reorderPoint ? "text-destructive" : "text-foreground")}>{i.currentStock}</td>
                                  <td className="px-4 py-2 text-right text-foreground">{i.reorderPoint}</td>
                                  <td className="px-4 py-2 text-right text-foreground">{i.suggestedQty}</td>
                                  <td className="px-4 py-2 text-right text-muted-foreground">{i.leadTime}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <p className="px-4 py-3 text-xs text-muted-foreground">Reorder points and suggested quantities are calculated from 12-month sales velocity and supplier lead time. No AI inference is used.</p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Inventory Loss Summary */}
                  {selectedKey === "inventory_loss" && (
                    <>
                      {(!inventoryLossData || inventoryLossData.length === 0) ? <NoData /> : (
                        <table className="w-full text-sm">
                          <thead><tr className="border-b bg-muted/50 text-left">
                            <th className="px-4 py-2 font-medium text-muted-foreground">Item</th>
                            <th className="px-4 py-2 font-medium text-muted-foreground text-right">Total Units Lost</th>
                            <th className="px-4 py-2 font-medium text-muted-foreground text-right">Est. Value Lost</th>
                          </tr></thead>
                          <tbody className="divide-y">
                            {inventoryLossData.map((i: any) => (
                              <tr key={i.name}>
                                <td className="px-4 py-2 font-medium text-foreground">{i.name}</td>
                                <td className="px-4 py-2 text-right text-foreground">{i.totalLoss}</td>
                                <td className="px-4 py-2 text-right font-medium text-destructive">${i.estimatedValue.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot><tr className="border-t bg-muted/30">
                            <td colSpan={2} className="px-4 py-2 font-semibold text-foreground text-right">Total Est. Loss</td>
                            <td className="px-4 py-2 text-right font-semibold text-destructive">${inventoryLossData.reduce((s: number, i: any) => s + i.estimatedValue, 0).toLocaleString()}</td>
                          </tr></tfoot>
                        </table>
                      )}
                    </>
                  )}

                  {/* Assembly History */}
                  {selectedKey === "assembly_history" && (
                    <>
                      {(!assemblyHistData || assemblyHistData.length === 0) ? <NoData /> : (
                        <table className="w-full text-sm">
                          <thead><tr className="border-b bg-muted/50 text-left">
                            <th className="px-4 py-2 w-8"></th>
                            <th className="px-4 py-2 font-medium text-muted-foreground">Date</th>
                            <th className="px-4 py-2 font-medium text-muted-foreground">Finished Item</th>
                            <th className="px-4 py-2 font-medium text-muted-foreground text-right">Qty Produced</th>
                          </tr></thead>
                          <tbody className="divide-y">
                            {assemblyHistData.map((r: any) => (
                              <>
                                <tr key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => toggleAssemblyExpand(r.id)}>
                                  <td className="px-4 py-2">
                                    {expandedAssemblyIds.has(r.id) ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                  </td>
                                  <td className="px-4 py-2 text-muted-foreground">{r.date}</td>
                                  <td className="px-4 py-2 font-medium text-foreground">{r.finishedItem}</td>
                                  <td className="px-4 py-2 text-right text-foreground">{r.qtyProduced}</td>
                                </tr>
                                {expandedAssemblyIds.has(r.id) && r.components.length > 0 && (
                                  <tr key={`${r.id}-components`}>
                                    <td colSpan={4} className="px-8 py-2 bg-muted/30">
                                      <table className="w-full text-xs">
                                        <thead><tr className="border-b">
                                          <th className="px-3 py-1 text-left font-medium text-muted-foreground">Component</th>
                                          <th className="px-3 py-1 text-right font-medium text-muted-foreground">Qty Consumed</th>
                                        </tr></thead>
                                        <tbody className="divide-y">
                                          {r.components.map((c: any, ci: number) => (
                                            <tr key={ci}>
                                              <td className="px-3 py-1 text-foreground">{c.name}</td>
                                              <td className="px-3 py-1 text-right text-foreground">{c.qtyConsumed}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </td>
                                  </tr>
                                )}
                              </>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </>
                  )}

                  {/* Margin by Item */}
                  {selectedKey === "margin_by_item" && (
                    <>
                      {(!marginItemData || marginItemData.length === 0) ? <NoData /> : (() => {
                        const totals = marginItemData.reduce((acc: any, i: any) => ({
                          revenue: acc.revenue + i.revenue,
                          cogs: acc.cogs + i.cogs,
                          grossMargin: acc.grossMargin + i.grossMargin,
                        }), { revenue: 0, cogs: 0, grossMargin: 0 });
                        const blendedPct = totals.revenue > 0 ? (totals.grossMargin / totals.revenue) * 100 : 0;
                        return (
                          <table className="w-full text-sm">
                            <thead><tr className="border-b bg-muted/50 text-left">
                              <th className="px-4 py-2 font-medium text-muted-foreground">Item</th>
                              <th className="px-4 py-2 font-medium text-muted-foreground text-right">Units Sold</th>
                              <th className="px-4 py-2 font-medium text-muted-foreground text-right">Revenue</th>
                              <th className="px-4 py-2 font-medium text-muted-foreground text-right">COGS</th>
                              <th className="px-4 py-2 font-medium text-muted-foreground text-right">Gross Margin</th>
                              <th className="px-4 py-2 font-medium text-muted-foreground text-right">Margin %</th>
                            </tr></thead>
                            <tbody className="divide-y">
                              {marginItemData.map((i: any) => (
                                <tr key={i.name}>
                                  <td className="px-4 py-2 font-medium text-foreground">{i.name}</td>
                                  <td className="px-4 py-2 text-right text-foreground">{i.units}</td>
                                  <td className="px-4 py-2 text-right text-foreground">${i.revenue.toLocaleString()}</td>
                                  <td className="px-4 py-2 text-right text-foreground">${i.cogs.toLocaleString()}</td>
                                  <td className="px-4 py-2 text-right font-medium text-foreground">${i.grossMargin.toLocaleString()}</td>
                                  <td className={cn("px-4 py-2 text-right font-medium", marginColor(i.marginPct))}>{i.marginPct.toFixed(1)}%</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot><tr className="border-t bg-muted/30">
                              <td colSpan={2} className="px-4 py-2 font-semibold text-foreground">Total</td>
                              <td className="px-4 py-2 text-right font-semibold text-foreground">${totals.revenue.toLocaleString()}</td>
                              <td className="px-4 py-2 text-right font-semibold text-foreground">${totals.cogs.toLocaleString()}</td>
                              <td className="px-4 py-2 text-right font-semibold text-foreground">${totals.grossMargin.toLocaleString()}</td>
                              <td className={cn("px-4 py-2 text-right font-semibold", marginColor(blendedPct))}>{blendedPct.toFixed(1)}%</td>
                            </tr></tfoot>
                          </table>
                        );
                      })()}
                    </>
                  )}

                  {/* Quarterly Revenue */}
                  {selectedKey === "quarterly_revenue" && (
                    <>
                      {(!quarterlyRevData || quarterlyRevData.length === 0) ? <NoData /> : (
                        <div className="p-4 space-y-4">
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={quarterlyRevData}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis dataKey="quarter" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v.toLocaleString()}`} />
                                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                          <table className="w-full text-sm">
                            <thead><tr className="border-b bg-muted/50"><th className="px-4 py-2 text-left font-medium text-muted-foreground">Quarter</th><th className="px-4 py-2 text-right font-medium text-muted-foreground">Total Revenue</th></tr></thead>
                            <tbody className="divide-y">
                              {quarterlyRevData.map((r) => (
                                <tr key={r.quarter}><td className="px-4 py-2 text-foreground">{r.quarter}</td><td className="px-4 py-2 text-right font-medium text-foreground">${r.total.toLocaleString()}</td></tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}

                  {/* Margins by Timeframe */}
                  {selectedKey === "margins_by_timeframe" && (
                    <>
                      {(!marginTimeData || marginTimeData.length === 0) ? <NoData /> : (() => {
                        const totals = marginTimeData.reduce((acc: any, r: any) => ({
                          revenue: acc.revenue + r.revenue,
                          cogs: acc.cogs + r.cogs,
                          grossMargin: acc.grossMargin + r.grossMargin,
                        }), { revenue: 0, cogs: 0, grossMargin: 0 });
                        const blendedPct = totals.revenue > 0 ? (totals.grossMargin / totals.revenue) * 100 : 0;
                        return (
                          <table className="w-full text-sm">
                            <thead><tr className="border-b bg-muted/50 text-left">
                              <th className="px-4 py-2 font-medium text-muted-foreground">Period</th>
                              <th className="px-4 py-2 font-medium text-muted-foreground text-right">Revenue</th>
                              <th className="px-4 py-2 font-medium text-muted-foreground text-right">COGS</th>
                              <th className="px-4 py-2 font-medium text-muted-foreground text-right">Gross Margin</th>
                              <th className="px-4 py-2 font-medium text-muted-foreground text-right">Margin %</th>
                            </tr></thead>
                            <tbody className="divide-y">
                              {marginTimeData.map((r: any) => (
                                <tr key={r.period}>
                                  <td className="px-4 py-2 text-foreground">{r.period}</td>
                                  <td className="px-4 py-2 text-right text-foreground">${r.revenue.toLocaleString()}</td>
                                  <td className="px-4 py-2 text-right text-foreground">${r.cogs.toLocaleString()}</td>
                                  <td className="px-4 py-2 text-right font-medium text-foreground">${r.grossMargin.toLocaleString()}</td>
                                  <td className={cn("px-4 py-2 text-right font-medium", marginColor(r.marginPct))}>{r.marginPct.toFixed(1)}%</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot><tr className="border-t bg-muted/30">
                              <td className="px-4 py-2 font-semibold text-foreground">Total</td>
                              <td className="px-4 py-2 text-right font-semibold text-foreground">${totals.revenue.toLocaleString()}</td>
                              <td className="px-4 py-2 text-right font-semibold text-foreground">${totals.cogs.toLocaleString()}</td>
                              <td className="px-4 py-2 text-right font-semibold text-foreground">${totals.grossMargin.toLocaleString()}</td>
                              <td className={cn("px-4 py-2 text-right font-semibold", marginColor(blendedPct))}>{blendedPct.toFixed(1)}%</td>
                            </tr></tfoot>
                          </table>
                        );
                      })()}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NoData() {
  return <div className="p-8 text-center text-muted-foreground">No data found for the selected criteria.</div>;
}
