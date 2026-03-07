import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function Assemblies() {
  const { orgId } = useAuth();

  const { data: records, isLoading } = useQuery({
    queryKey: ["assembly-records", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("assembly_records")
        .select("*, inventory_items!assembly_records_finished_item_id_fkey(name), profiles!assembly_records_created_by_fkey(full_name)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div>
      <PageHeader
        title="Assembly Records"
        description="Track manufacturing and finished goods production"
        actions={
          <Button>
            <Plus className="h-4 w-4" />
            New Assembly
          </Button>
        }
      />

      <div className="p-8">
        <div className="fieldcore-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-5 py-3 font-medium text-muted-foreground">Finished Item</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Qty Produced</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Created By</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Notes</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">Loading...</td></tr>
              )}
              {records?.length === 0 && !isLoading && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">No assembly records yet</td></tr>
              )}
              {records?.map((r: any) => (
                <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3 font-medium text-foreground">{r.inventory_items?.name ?? "—"}</td>
                  <td className="px-5 py-3 text-foreground">{r.quantity_produced}</td>
                  <td className="px-5 py-3 text-muted-foreground">{r.profiles?.full_name ?? "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground truncate max-w-xs">{r.notes ?? "—"}</td>
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
