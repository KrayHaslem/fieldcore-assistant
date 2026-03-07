import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function Inventory() {
  const { orgId } = useAuth();

  const { data: items, isLoading } = useQuery({
    queryKey: ["inventory-items", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("inventory_items")
        .select("*, suppliers:preferred_supplier_id(name)")
        .order("name");
      return data ?? [];
    },
  });

  // Get on-hand quantities via inventory_movements
  const { data: quantities } = useQuery({
    queryKey: ["inventory-quantities", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("inventory_movements")
        .select("item_id, quantity");
      const map: Record<string, number> = {};
      data?.forEach((m: any) => {
        map[m.item_id] = (map[m.item_id] ?? 0) + m.quantity;
      });
      return map;
    },
  });

  const typeLabels: Record<string, string> = {
    resale: "Resale",
    manufacturing_input: "Manufacturing",
    internal_use: "Internal Use",
    consumable: "Consumable",
  };

  const typeColors: Record<string, string> = {
    resale: "status-approved",
    manufacturing_input: "status-submitted",
    internal_use: "status-ordered",
    consumable: "status-draft",
  };

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Track items, stock levels, and classifications"
        actions={
          <Button>
            <Plus className="h-4 w-4" />
            Add Item
          </Button>
        }
      />

      <div className="p-8">
        <div className="fieldcore-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-5 py-3 font-medium text-muted-foreground">Item</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">SKU</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Type</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">On Hand</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Reorder Point</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Unit Cost</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Supplier</th>
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
              {items?.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">
                    No inventory items yet
                  </td>
                </tr>
              )}
              {items?.map((item: any) => {
                const onHand = quantities?.[item.id] ?? 0;
                const isLow = item.reorder_point && onHand <= item.reorder_point;
                return (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-foreground">{item.name}</p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-xs">{item.description}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{item.sku ?? "—"}</td>
                    <td className="px-5 py-3">
                      <span className={`status-badge ${typeColors[item.item_type]}`}>
                        {typeLabels[item.item_type]}
                      </span>
                    </td>
                    <td className={`px-5 py-3 font-medium ${isLow ? "text-destructive" : "text-foreground"}`}>
                      {onHand}
                      {isLow && <span className="ml-1 text-xs text-destructive">↓ Low</span>}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{item.reorder_point ?? "—"}</td>
                    <td className="px-5 py-3 text-foreground">
                      {item.default_unit_cost ? `$${Number(item.default_unit_cost).toFixed(2)}` : "—"}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{item.suppliers?.name ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
