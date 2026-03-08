import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subMonths, subQuarters, subYears } from "date-fns";
import { CalendarIcon, ShoppingCart, Package, DollarSign, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type ReportKey = "spending_supplier" | "open_pos" | "pending_approvals" | "inventory_valuation" | "reconciliation_history" | "sales_by_item" | "sales_by_salesperson";

interface ReportDef {
  key: ReportKey;
  name: string;
  description: string;
  hasDateRange: boolean;
}

const reportCategories: { title: string; icon: typeof ShoppingCart; reports: ReportDef[] }[] = [
  {
    title: "Purchasing",
    icon: ShoppingCart,
    reports: [
      { key: "spending_supplier", name: "Spending by Supplier", description: "Total spend grouped by supplier", hasDateRange: true },
      { key: "open_pos", name: "Open Purchase Orders", description: "All POs not yet closed", hasDateRange: false },
      { key: "pending_approvals", name: "Pending Approvals", description: "POs awaiting approval by department", hasDateRange: false },
    ],
  },
  {
    title: "Inventory",
    icon: Package,
    reports: [
      { key: "inventory_valuation", name: "Inventory Valuation", description: "On-hand quantity × unit cost per item", hasDateRange: false },
      { key: "reconciliation_history", name: "Reconciliation History", description: "Expected vs actual and variance over time", hasDateRange: true },
    ],
  },
  {
    title: "Sales",
    icon: DollarSign,
    reports: [
      { key: "sales_by_item", name: "Sales by Item", description: "Units sold and revenue per item", hasDateRange: true },
    ],
  },
];

const allReports = reportCategories.flatMap((c) => c.reports);

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

export default function Reports() {
  const { orgId } = useAuth();
  const [selectedKey, setSelectedKey] = useState<ReportKey | null>(null);
  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(endOfMonth(new Date()));

  const selected = allReports.find((r) => r.key === selectedKey) ?? null;

  const quickSelect = (start: Date, end: Date) => { setStartDate(start); setEndDate(end); };
  const now = new Date();

  // ---- Queries ----
  const startISO = startDate?.toISOString();
  const endISO = endDate?.toISOString();

  const { data: spendingData, isLoading: loadingSpending } = useQuery({
    queryKey: ["report-spending-supplier", orgId, startISO, endISO],
    enabled: selectedKey === "spending_supplier" && !!orgId,
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
    enabled: selectedKey === "open_pos" && !!orgId,
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
    enabled: selectedKey === "pending_approvals" && !!orgId,
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
    enabled: selectedKey === "inventory_valuation" && !!orgId,
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
    enabled: selectedKey === "reconciliation_history" && !!orgId,
    queryFn: async () => {
      let q = supabase.from("reconciliations").select("*, inventory_items!reconciliations_item_id_fkey(name)").order("created_at", { ascending: false });
      if (startISO) q = q.gte("created_at", startISO);
      if (endISO) q = q.lte("created_at", endISO);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: salesItemData, isLoading: loadingSales } = useQuery({
    queryKey: ["report-sales-item", orgId, startISO, endISO],
    enabled: selectedKey === "sales_by_item" && !!orgId,
    queryFn: async () => {
      // Get qualifying sales orders
      let soQ = supabase.from("sales_orders").select("id").in("status", ["fulfilled", "invoiced", "paid", "closed"]);
      if (startISO) soQ = soQ.gte("created_at", startISO);
      if (endISO) soQ = soQ.lte("created_at", endISO);
      const { data: sos } = await soQ;
      if (!sos || sos.length === 0) return [];
      const soIds = sos.map((s) => s.id);
      const { data: items } = await supabase.from("sales_order_items").select("item_id, quantity, unit_price, inventory_items:item_id(name)").in("sales_order_id", soIds);
      const map: Record<string, { name: string; units: number; revenue: number }> = {};
      (items ?? []).forEach((li: any) => {
        const name = li.inventory_items?.name ?? "Unknown";
        if (!map[li.item_id]) map[li.item_id] = { name, units: 0, revenue: 0 };
        map[li.item_id].units += li.quantity;
        map[li.item_id].revenue += li.quantity * Number(li.unit_price);
      });
      return Object.values(map).sort((a, b) => b.revenue - a.revenue);
    },
  });

  const isLoading = selectedKey === "spending_supplier" ? loadingSpending
    : selectedKey === "open_pos" ? loadingOpen
    : selectedKey === "pending_approvals" ? loadingPending
    : selectedKey === "inventory_valuation" ? loadingValuation
    : selectedKey === "reconciliation_history" ? loadingRecon
    : selectedKey === "sales_by_item" ? loadingSales
    : false;

  return (
    <div>
      <PageHeader title="Reports" description="Data-driven insights from your operations" />
      <div className="flex p-8 gap-6 max-w-7xl">
        {/* Left — Report Selector */}
        <div className="w-64 shrink-0 space-y-6">
          {reportCategories.map((cat) => (
            <div key={cat.title}>
              <div className="flex items-center gap-2 mb-2">
                <cat.icon className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{cat.title}</h3>
              </div>
              <div className="space-y-1">
                {cat.reports.map((r) => (
                  <button
                    key={r.key}
                    onClick={() => setSelectedKey(r.key)}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm rounded-md transition-colors",
                      selectedKey === r.key ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted"
                    )}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Right — Report Display */}
        <div className="flex-1 min-w-0">
          {!selected ? (
            <div className="fieldcore-card p-12 text-center text-muted-foreground">
              <BarChart3 className="mx-auto h-10 w-10 mb-3 opacity-40" />
              <p>Select a report from the left panel</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="fieldcore-card p-4">
                <h2 className="text-lg font-semibold text-foreground">{selected.name}</h2>
                <p className="text-sm text-muted-foreground">{selected.description}</p>
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
