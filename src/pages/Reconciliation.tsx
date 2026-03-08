import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { ComboBox, type ComboBoxOption } from "@/components/ComboBox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ClipboardCheck } from "lucide-react";

interface ItemOption extends ComboBoxOption {
  sku: string | null;
  item_type: string;
}

export default function Reconciliation() {
  const { user, orgId, roles } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const canReconcile = roles.includes("admin") || roles.includes("procurement");

  // Form state
  const [selectedItem, setSelectedItem] = useState<ItemOption | null>(null);
  const [actualCount, setActualCount] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Expected quantity query
  const { data: expectedQty, isLoading: loadingExpected } = useQuery({
    queryKey: ["expected-quantity", selectedItem?.id],
    enabled: !!selectedItem,
    queryFn: async () => {
      const { data } = await supabase
        .from("inventory_movements")
        .select("quantity")
        .eq("item_id", selectedItem!.id);
      return (data ?? []).reduce((sum, m) => sum + m.quantity, 0);
    },
  });

  // Item search
  const handleSearch = useCallback(async (query: string): Promise<ItemOption[]> => {
    const { data } = await supabase
      .from("inventory_items")
      .select("id, name, sku, item_type")
      .in("item_type", ["resale", "manufacturing_input", "consumable"])
      .ilike("name", `%${query}%`)
      .limit(20);
    return (data ?? []).map((i) => ({ id: i.id, label: i.name, sku: i.sku, item_type: i.item_type }));
  }, []);

  const handleSave = async () => {
    if (!selectedItem || !user || !orgId) return;
    const actual = parseInt(actualCount, 10);
    if (isNaN(actual) || actual < 0) {
      toast({ title: "Invalid count", description: "Enter a valid non-negative number.", variant: "destructive" });
      return;
    }
    const expected = expectedQty ?? 0;
    const variance = actual - expected;

    setIsSaving(true);
    try {
      // 1. Insert reconciliation record
      const { data: rec, error: recErr } = await supabase
        .from("reconciliations")
        .insert({
          organization_id: orgId,
          item_id: selectedItem.id,
          expected_quantity: expected,
          actual_quantity: actual,
          variance,
          notes: notes || null,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (recErr) throw recErr;

      // 2. Insert inventory movement for the variance
      if (variance !== 0) {
        const { error: movErr } = await supabase.from("inventory_movements").insert({
          organization_id: orgId,
          item_id: selectedItem.id,
          movement_type: "reconciliation" as const,
          quantity: variance,
          source_type: "reconciliation" as const,
          source_id: rec.id,
          created_by: user.id,
          notes: `Reconciliation: expected ${expected}, counted ${actual}`,
        });
        if (movErr) throw movErr;
      }

      toast({
        title: "Reconciliation Saved",
        description: `Variance: ${variance > 0 ? "+" : ""}${variance} units recorded`,
      });

      // Reset form
      setSelectedItem(null);
      setActualCount("");
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["reconciliations"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-quantities"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // History query
  const { data: records, isLoading } = useQuery({
    queryKey: ["reconciliations", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("reconciliations")
        .select("*, inventory_items!reconciliations_item_id_fkey(name)")
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

      <div className="p-8 max-w-5xl space-y-8">
        {/* SECTION 1 — New Reconciliation */}
        {canReconcile && (
          <div className="fieldcore-card p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Start New Reconciliation</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label className="text-sm text-muted-foreground">Search Item</Label>
                <ComboBox
                  value={selectedItem}
                  onChange={setSelectedItem}
                  onSearch={handleSearch}
                  placeholder="Search inventory items..."
                  renderOption={(opt) => (
                    <div>
                      <span className="font-medium">{opt.label}</span>
                      {opt.sku && <span className="ml-2 text-xs text-muted-foreground">{opt.sku}</span>}
                      <span className="ml-2 text-xs text-muted-foreground capitalize">{opt.item_type.replace("_", " ")}</span>
                    </div>
                  )}
                />
              </div>

              {selectedItem && (
                <>
                  <div>
                    <Label className="text-sm text-muted-foreground">Expected Quantity</Label>
                    <div className="h-10 flex items-center px-3 rounded-md border bg-muted/50 text-sm font-medium text-foreground">
                      {loadingExpected ? "Calculating..." : expectedQty ?? 0}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Actual Physical Count</Label>
                    <Input
                      type="number"
                      min="0"
                      value={actualCount}
                      onChange={(e) => setActualCount(e.target.value)}
                      placeholder="Enter count"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-sm text-muted-foreground">Notes</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Optional notes about this reconciliation..."
                      rows={2}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Button onClick={handleSave} disabled={isSaving || !actualCount}>
                      {isSaving ? "Saving..." : "Save Reconciliation"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* SECTION 2 — History */}
        <div className="fieldcore-card overflow-hidden">
          <div className="border-b px-5 py-3">
            <h3 className="text-sm font-semibold text-foreground">Reconciliation History</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-5 py-3 font-medium text-muted-foreground">Item</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Expected</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Actual</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Variance</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Notes</th>
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
                  <td className={`px-5 py-3 font-medium ${r.variance < 0 ? "text-destructive" : r.variance > 0 ? "text-green-600" : "text-muted-foreground"}`}>
                    {r.variance > 0 ? "+" : ""}{r.variance}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground max-w-[200px] truncate">{r.notes ?? "—"}</td>
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
