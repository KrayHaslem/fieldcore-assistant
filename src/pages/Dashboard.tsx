import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const { orgId, profile, roles } = useAuth();
  const navigate = useNavigate();
  const [command, setCommand] = useState("");

  // Pending POs
  const { data: pendingPOs } = useQuery({
    queryKey: ["pending-pos", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("purchase_orders")
        .select("id, po_number, supplier_id, status, total_amount, created_at, suppliers(name)")
        .in("status", ["submitted", "approved", "ordered"])
        .order("created_at", { ascending: false })
        .limit(10);
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
    queryKey: ["command-history", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("command_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;
    // For now, navigate with command as query param. AI integration comes later.
    navigate(`/command?q=${encodeURIComponent(command)}`);
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
            />
            <Button type="submit">Run</Button>
          </form>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Purchase Orders"
            value={stats?.totalPOs ?? 0}
            icon={ShoppingCart}
          />
          <StatCard
            label="Pending Approvals"
            value={stats?.pendingApprovals ?? 0}
            icon={AlertTriangle}
            className={stats?.pendingApprovals ? "border-accent/50" : ""}
          />
          <StatCard
            label="Sales Orders"
            value={stats?.totalSOs ?? 0}
            icon={DollarSign}
          />
          <StatCard
            label="Inventory Items"
            value={stats?.totalItems ?? 0}
            icon={Package}
          />
        </div>

        {/* Pending Actions & Command History */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Pending POs */}
          <div className="fieldcore-card">
            <div className="border-b px-5 py-3">
              <h3 className="text-sm font-semibold text-foreground">Pending Actions</h3>
            </div>
            <div className="divide-y">
              {pendingPOs?.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                  No pending actions
                </p>
              )}
              {pendingPOs?.map((po: any) => (
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

          {/* Command History */}
          <div className="fieldcore-card">
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
                    <span className="status-badge status-submitted ml-3">{cmd.intent_type}</span>
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
