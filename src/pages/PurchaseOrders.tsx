import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Plus, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PurchaseOrders() {
  const { orgId, user, roles } = useAuth();
  const navigate = useNavigate();

  const isEmployeeOnly = roles.length > 0 &&
    !roles.includes("admin") &&
    !roles.includes("procurement") &&
    !roles.includes("finance") &&
    !roles.includes("sales");

  const { data: orders, isLoading } = useQuery({
    queryKey: ["purchase-orders", orgId, user?.id, roles],
    enabled: !!orgId,
    queryFn: async () => {
      let q = supabase
        .from("purchase_orders")
        .select("*, suppliers(name), has_shortfall, po_groups(po_number)");

      if (isEmployeeOnly) {
        q = q.eq("created_by", user!.id);
      }

      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) {
        console.error("Orders query error:", error);
        return [];
      }
      
      // Fetch creator names separately since there's no FK from purchase_orders to profiles
      const creatorIds = [...new Set((data ?? []).map((po: any) => po.created_by).filter(Boolean))];
      let profileMap: Record<string, string> = {};
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", creatorIds);
        profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.user_id, p.full_name]));
      }
      
      return (data ?? []).map((po: any) => ({
        ...po,
        creator_name: profileMap[po.created_by] ?? "—",
      }));
    },
  });

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Manage purchasing workflows"
        actions={
          <Button onClick={() => navigate("/purchase-orders/new")}>
            <Plus className="h-4 w-4" />
            New Order
          </Button>
        }
      />

      <div className="p-8">
        <div className="fieldcore-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-5 py-3 font-medium text-muted-foreground">Order #</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Supplier</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Created By</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Amount</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">PO Group</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">
                    Loading...
                  </td>
                </tr>
              )}
              {orders?.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">
                    No orders yet
                  </td>
                </tr>
              )}
              {orders?.map((po: any) => (
                <tr
                  key={po.id}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => navigate(`/purchase-orders/${po.id}`)}
                >
                  <td className="px-5 py-3 font-medium text-foreground">{po.po_number}</td>
                  <td className="px-5 py-3 text-foreground">{po.suppliers?.name ?? "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{po.profiles?.full_name ?? "—"}</td>
                  <td className="px-5 py-3 font-medium text-foreground">
                    ${Number(po.total_amount).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {(po as any).po_groups?.po_number ? (
                      <Link
                        to={`/po-groups/${(po as any).po_group_id}`}
                        className="text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {(po as any).po_groups.po_number}
                      </Link>
                    ) : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={po.status} />
                      {po.has_shortfall && (
                        <span title="Has shortfall">
                          <AlertTriangle className="h-4 w-4 text-warning" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {new Date(po.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
