import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function SalesOrders() {
  const { orgId } = useAuth();
  const navigate = useNavigate();

  const { data: orders, isLoading } = useQuery({
    queryKey: ["sales-orders", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("sales_orders")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div>
      <PageHeader
        title="Sales Orders"
        description="Manage quotes, orders, and invoices"
        actions={
          <Button onClick={() => navigate("/sales/new")}>
            <Plus className="h-4 w-4" /> New Order
          </Button>
        }
      />

      <div className="p-8">
        <div className="fieldcore-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-5 py-3 font-medium text-muted-foreground">SO #</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Customer</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-5 py-3 font-medium text-muted-foreground text-right">Total</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">Loading...</td></tr>
              )}
              {orders?.length === 0 && !isLoading && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">No sales orders yet</td></tr>
              )}
              {orders?.map((so: any) => (
                <tr
                  key={so.id}
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/sales/${so.id}`)}
                >
                  <td className="px-5 py-3 font-medium text-foreground">{so.so_number}</td>
                  <td className="px-5 py-3 text-foreground">{so.customer_name}</td>
                  <td className="px-5 py-3"><StatusBadge status={so.status} /></td>
                  <td className="px-5 py-3 text-right font-medium text-foreground">${Number(so.total_amount).toLocaleString()}</td>
                  <td className="px-5 py-3 text-muted-foreground">{new Date(so.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
