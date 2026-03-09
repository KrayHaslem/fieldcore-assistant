import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import {
  ShoppingCart,
  Package,
  DollarSign,
  AlertTriangle,
  Terminal,
  Clock,
  Loader2,
  FileText,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { orgId, user, profile, roles } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [command, setCommand] = useState("");
  const [isParsingCommand, setIsParsingCommand] = useState(false);

  // Pending POs awaiting YOUR approval via RPC
  const { data: approvalQueueIds } = useQuery({
    queryKey: ["awaiting-your-approval-ids", orgId, user?.id],
    enabled: !!orgId && !!user && (roles.includes("admin") || roles.includes("procurement") || roles.includes("finance")),
    queryFn: async () => {
      const { data } = await supabase.rpc("get_my_approval_queue", { _user_id: user!.id });
      return (data ?? []).map((po: any) => po.id);
    },
  });

  const { data: awaitingYourApproval } = useQuery({
    queryKey: ["awaiting-your-approval", approvalQueueIds],
    enabled: !!approvalQueueIds && approvalQueueIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("purchase_orders")
        .select("id, po_number, status, total_amount, created_at, suppliers(name)")
        .in("id", approvalQueueIds!)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  // POs YOU submitted that are awaiting approval
  const { data: yourPendingPOs } = useQuery({
    queryKey: ["your-pending-pos", orgId, user?.id],
    enabled: !!orgId && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("purchase_orders")
        .select("id, po_number, status, total_amount, created_at, suppliers(name)")
        .eq("created_by", user!.id)
        .in("status", ["submitted", "approved", "ordered"])
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  // Low inventory alerts
  const { data: lowStockItems } = useQuery({
    queryKey: ["low-stock", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase.rpc("get_low_stock_items", { _org_id: orgId! });
      return data ?? [];
    },
  });

  // Open reconciliations (non-zero variance, recent)
  const { data: openReconciliations } = useQuery({
    queryKey: ["open-reconciliations", orgId],
    enabled: !!orgId && (roles.includes("admin") || roles.includes("procurement")),
    queryFn: async () => {
      const { data } = await supabase
        .from("reconciliations")
        .select("id, created_at, variance, inventory_items:item_id(name)")
        .neq("variance", 0)
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  // Unfulfilled sales orders (quote or order status)
  const { data: unfulfilledSalesOrders } = useQuery({
    queryKey: ["unfulfilled-sales-orders", orgId],
    enabled: !!orgId && (roles.includes("admin") || roles.includes("sales")),
    queryFn: async () => {
      const { data } = await supabase
        .from("sales_orders")
        .select("id, so_number, customer_name, total_amount, status, created_at")
        .in("status", ["quote", "order"])
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  // Stats
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const [pos, sos, items] = await Promise.all([
        supabase.from("purchase_orders").select("id, status", { count: "exact" }),
        supabase.from("sales_orders").select("id", { count: "exact" }),
        supabase.from("inventory_items").select("id", { count: "exact" }),
      ]);
      const pendingCount = pos.data?.filter((p) => p.status === "submitted").length ?? 0;
      return {
        totalPOs: pos.count ?? 0,
        pendingApprovals: pendingCount,
        totalSOs: sos.count ?? 0,
        totalItems: items.count ?? 0,
      };
    },
  });

  // Command history
  const { data: commandHistory } = useQuery({
    queryKey: ["command-history", orgId, user?.id],
    enabled: !!orgId && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("command_history")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || isParsingCommand) return;

    setIsParsingCommand(true);
    try {
      // Call the AI parse-command edge function
      const { data, error } = await supabase.functions.invoke("parse-command", {
        body: { command: command.trim() },
      });

      if (error) throw error;

      // Save to command history
      await supabase.from("command_history").insert({
        command_text: command.trim(),
        intent_type: data?.intent || "unknown",
        intent_data: data,
        user_id: user!.id,
        organization_id: orgId!,
      });

      queryClient.invalidateQueries({ queryKey: ["command-history"] });

      // Route based on intent
      const intent = data?.intent;
      if (intent === "create_purchase_order") {
        navigate("/purchase-orders/new", { state: { prefill: data } });
      } else if (intent === "create_sales_order") {
        navigate("/sales", { state: { prefill: data } });
      } else if (intent === "show_report") {
        navigate("/reports", {
          state: {
            prefill: data,
            startDate: data.date_range?.start ?? null,
            endDate: data.date_range?.end ?? null,
          },
        });
      } else if (intent === "reconcile_item") {
        navigate("/reconciliation", { state: { prefill: data } });
      } else if (intent === "record_assembly") {
        navigate("/assemblies", { state: { prefill: data } });
      } else if (intent === "navigate") {
        const dest = data?.destination?.toLowerCase();
        if (dest?.includes("purchase")) navigate("/purchase-orders");
        else if (dest?.includes("inventor")) navigate("/inventory");
        else if (dest?.includes("sales")) navigate("/sales");
        else if (dest?.includes("assembl")) navigate("/assemblies");
        else if (dest?.includes("reconcil")) navigate("/reconciliation");
        else if (dest?.includes("report")) navigate("/reports");
        else if (dest?.includes("setting")) navigate("/settings");
        else toast({ title: "Command Parsed", description: `Intent: ${intent}` });
      } else {
        toast({ title: "Command Parsed", description: `Intent: ${intent || "unknown"}. Check command history for details.` });
      }

      setCommand("");
    } catch (err: any) {
      toast({
        title: "Command Error",
        description: err.message || "Failed to parse command",
        variant: "destructive",
      });
    } finally {
      setIsParsingCommand(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${profile?.full_name?.split(" ")[0] ?? "User"}`}
        description="FieldCore Resource Systems — your command center"
      />

      <div className="space-y-6 p-8">
        {/* Command Input */}
        <div className="fieldcore-card p-6">
          <div className="flex items-center gap-3 mb-3">
            <Terminal className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Command Center</h2>
          </div>
          <form onSubmit={handleCommand} className="flex gap-3">
            <input
              type="text"
              className="command-input flex-1"
              placeholder="Try: 'Order 3 MIG wire spools from Logan Supply' or 'Show quarterly spending report'"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              disabled={isParsingCommand}
            />
            <Button type="submit" disabled={isParsingCommand || !command.trim()}>
              {isParsingCommand ? <Loader2 className="h-4 w-4 animate-spin" /> : "Run"}
            </Button>
          </form>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Purchase Orders" value={stats?.totalPOs ?? 0} icon={ShoppingCart} />
          <StatCard
            label="Pending Approvals"
            value={stats?.pendingApprovals ?? 0}
            icon={AlertTriangle}
            className={stats?.pendingApprovals ? "border-accent/50" : ""}
          />
          <StatCard label="Sales Orders" value={stats?.totalSOs ?? 0} icon={DollarSign} />
          <StatCard label="Inventory Items" value={stats?.totalItems ?? 0} icon={Package} />
        </div>

        {/* Pending Actions & Command History */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Pending Actions */}
          <div className="space-y-4">
            {/* Awaiting Your Approval */}
            {(roles.includes("admin") || roles.includes("procurement") || roles.includes("finance")) && (
              <div className="fieldcore-card">
                <div className="border-b px-5 py-3 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-accent" />
                  <h3 className="text-sm font-semibold text-foreground">Awaiting Your Approval</h3>
                </div>
                <div className="divide-y">
                  {awaitingYourApproval?.length === 0 && (
                    <p className="px-5 py-6 text-center text-sm text-muted-foreground">
                      No orders awaiting approval
                    </p>
                  )}
                  {awaitingYourApproval?.map((po: any) => (
                    <div
                      key={po.id}
                      className="flex items-center justify-between px-5 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/purchase-orders/${po.id}`)}
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{po.po_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {po.suppliers?.name ?? "Unknown supplier"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-foreground">
                          ${Number(po.total_amount).toLocaleString()}
                        </span>
                        <StatusBadge status={po.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Your Submitted POs */}
            <div className="fieldcore-card">
              <div className="border-b px-5 py-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Your Active Orders</h3>
              </div>
              <div className="divide-y">
                {yourPendingPOs?.length === 0 && (
                  <p className="px-5 py-6 text-center text-sm text-muted-foreground">
                    No active orders
                  </p>
                )}
                {yourPendingPOs?.map((po: any) => (
                  <div
                    key={po.id}
                    className="flex items-center justify-between px-5 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/purchase-orders/${po.id}`)}
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{po.po_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {po.suppliers?.name ?? "Unknown"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-foreground">
                        ${Number(po.total_amount).toLocaleString()}
                      </span>
                      <StatusBadge status={po.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Low Inventory Alerts */}
            {lowStockItems && lowStockItems.length > 0 && (
              <div className="fieldcore-card">
                <div className="border-b px-5 py-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <h3 className="text-sm font-semibold text-foreground">Low Inventory</h3>
                </div>
                <div className="divide-y">
                  {lowStockItems.map((item: any) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between px-5 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate("/inventory")}
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.name}</p>
                        {item.sku && <p className="text-xs text-muted-foreground">{item.sku}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-destructive">{item.current_stock} on hand</p>
                        <p className="text-xs text-muted-foreground">Reorder at {item.reorder_point}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Open Reconciliations */}
            {(roles.includes("admin") || roles.includes("procurement")) && openReconciliations && openReconciliations.length > 0 && (
              <div className="fieldcore-card">
                <div className="border-b px-5 py-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-accent" />
                  <h3 className="text-sm font-semibold text-foreground">Open Reconciliations</h3>
                </div>
                <div className="divide-y">
                  {openReconciliations.map((r: any) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between px-5 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate("/reconciliation")}
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{r.inventory_items?.name ?? "Unknown item"}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <p className={`text-sm font-medium ${r.variance < 0 ? "text-destructive" : "text-foreground"}`}>
                        Variance: {r.variance > 0 ? "+" : ""}{r.variance}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unfulfilled Sales Orders */}
            {(roles.includes("admin") || roles.includes("sales")) && unfulfilledSalesOrders && unfulfilledSalesOrders.length > 0 && (
              <div className="fieldcore-card">
                <div className="border-b px-5 py-3 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Unfulfilled Sales Orders</h3>
                </div>
                <div className="divide-y">
                  {unfulfilledSalesOrders.map((so: any) => (
                    <div
                      key={so.id}
                      className="flex items-center justify-between px-5 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/sales/${so.id}`)}
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{so.so_number}</p>
                        <p className="text-xs text-muted-foreground">{so.customer_name}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-foreground">
                          ${Number(so.total_amount).toLocaleString()}
                        </span>
                        <StatusBadge status={so.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Command History */}
          <div className="fieldcore-card h-fit">
            <div className="border-b px-5 py-3">
              <h3 className="text-sm font-semibold text-foreground">Recent Commands</h3>
            </div>
            <div className="divide-y">
              {commandHistory?.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                  No commands yet. Try the command input above!
                </p>
              )}
              {commandHistory?.map((cmd: any) => (
                <div key={cmd.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{cmd.command_text}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {new Date(cmd.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  {cmd.intent_type && (
                    <span className="status-badge status-submitted ml-3 whitespace-nowrap">{cmd.intent_type}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
