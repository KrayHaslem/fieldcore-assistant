import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function POGroups() {
  const { orgId } = useAuth();
  const navigate = useNavigate();

  const { data: groups, isLoading } = useQuery({
    queryKey: ["po-groups", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("po_groups")
        .select("*, purchase_orders(id, total_amount)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((g: any) => ({
        ...g,
        order_count: g.purchase_orders?.length ?? 0,
        combined_total: (g.purchase_orders ?? []).reduce(
          (sum: number, po: any) => sum + Number(po.total_amount ?? 0),
          0
        ),
      }));
    },
  });

  return (
    <div>
      <PageHeader
        title="PO Groups"
        description="Group approved orders under official PO numbers"
        actions={
          <Button onClick={() => navigate("/po-groups/new")}>
            <Plus className="h-4 w-4" />
            New PO Group
          </Button>
        }
      />

      <div className="p-8">
        <div className="fieldcore-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-5 py-3 font-medium text-muted-foreground">PO Number</th>
                <th className="px-5 py-3 font-medium text-muted-foreground text-right">Orders</th>
                <th className="px-5 py-3 font-medium text-muted-foreground text-right">Combined Total</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Notes</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">Loading...</td>
                </tr>
              )}
              {!isLoading && groups?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">No PO groups yet</td>
                </tr>
              )}
              {groups?.map((g: any) => (
                <tr
                  key={g.id}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => navigate(`/po-groups/${g.id}`)}
                >
                  <td className="px-5 py-3 font-medium text-foreground">{g.po_number}</td>
                  <td className="px-5 py-3 text-right text-foreground">{g.order_count}</td>
                  <td className="px-5 py-3 text-right font-medium text-foreground">
                    ${g.combined_total.toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground truncate max-w-[200px]">{g.notes ?? "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {new Date(g.created_at).toLocaleDateString()}
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
