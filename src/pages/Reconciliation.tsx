import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";

export default function Reconciliation() {
  const { orgId } = useAuth();

  const { data: records, isLoading } = useQuery({
    queryKey: ["reconciliations", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("reconciliations")
        .select("*, inventory_items!reconciliations_item_id_fkey(name), profiles!reconciliations_created_by_fkey(full_name)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div>
      <PageHeader
        title="Inventory Reconciliation"
        description="Compare expected vs actual stock counts"
      />

      <div className="p-8">
        <div className="fieldcore-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-5 py-3 font-medium text-muted-foreground">Item</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Expected</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Actual</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Variance</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">By</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">Loading...</td></tr>
              )}
              {records?.length === 0 && !isLoading && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">No reconciliations yet</td></tr>
              )}
              {records?.map((r: any) => (
                <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3 font-medium text-foreground">{r.inventory_items?.name ?? "—"}</td>
                  <td className="px-5 py-3 text-foreground">{r.expected_quantity}</td>
                  <td className="px-5 py-3 text-foreground">{r.actual_quantity}</td>
                  <td className={`px-5 py-3 font-medium ${r.variance < 0 ? "text-destructive" : r.variance > 0 ? "text-success" : "text-foreground"}`}>
                    {r.variance > 0 ? "+" : ""}{r.variance}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{r.profiles?.full_name ?? "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
