import { useState, useCallback, Fragment } from "react";
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
import { Plus, Trash2, ChevronDown, ChevronRight, Hammer } from "lucide-react";

interface ItemOption extends ComboBoxOption {
  sku: string | null;
}

interface ComponentRow {
  key: number;
  item: ItemOption | null;
  quantity: string;
}

let rowKeyCounter = 0;

export default function Assemblies() {
  const { user, orgId, roles } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const canCreate = roles.includes("admin") || roles.includes("procurement") || roles.includes("employee");

  // Form state
  const [finishedItem, setFinishedItem] = useState<ItemOption | null>(null);
  const [qtyProduced, setQtyProduced] = useState("");
  const [components, setComponents] = useState<ComponentRow[]>([]);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Search finished goods (resale)
  const searchFinished = useCallback(async (query: string): Promise<ItemOption[]> => {
    const { data } = await supabase
      .from("inventory_items")
      .select("id, name, sku")
      .eq("item_type", "resale")
      .ilike("name", `%${query}%`)
      .limit(20);
    return (data ?? []).map((i) => ({ id: i.id, label: i.name, sku: i.sku }));
  }, []);

  // Search components (manufacturing_input)
  const searchComponents = useCallback(async (query: string): Promise<ItemOption[]> => {
    const { data } = await supabase
      .from("inventory_items")
      .select("id, name, sku")
      .eq("item_type", "manufacturing_input")
      .ilike("name", `%${query}%`)
      .limit(20);
    return (data ?? []).map((i) => ({ id: i.id, label: i.name, sku: i.sku }));
  }, []);

  const addComponent = () => {
    setComponents((prev) => [...prev, { key: ++rowKeyCounter, item: null, quantity: "" }]);
  };

  const removeComponent = (key: number) => {
    setComponents((prev) => prev.filter((c) => c.key !== key));
  };

  const updateComponent = (key: number, field: "item" | "quantity", value: any) => {
    setComponents((prev) =>
      prev.map((c) => (c.key === key ? { ...c, [field]: value } : c))
    );
  };

  const resetForm = () => {
    setFinishedItem(null);
    setQtyProduced("");
    setComponents([]);
    setNotes("");
  };

  const handleSave = async () => {
    if (!finishedItem || !user || !orgId) return;
    const qty = parseInt(qtyProduced, 10);
    if (isNaN(qty) || qty <= 0) {
      toast({ title: "Invalid quantity", description: "Enter a positive number.", variant: "destructive" });
      return;
    }

    // Validate component rows that have items selected
    const validComponents = components.filter((c) => c.item);
    for (const c of validComponents) {
      const cq = parseInt(c.quantity, 10);
      if (isNaN(cq) || cq <= 0) {
        toast({ title: "Invalid component quantity", description: `Enter a valid quantity for ${c.item!.label}.`, variant: "destructive" });
        return;
      }
    }

    setIsSaving(true);
    try {
      // 1. Insert assembly record
      const { data: rec, error: recErr } = await supabase
        .from("assembly_records")
        .insert({
          organization_id: orgId,
          finished_item_id: finishedItem.id,
          quantity_produced: qty,
          notes: notes || null,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (recErr) throw recErr;

      // 2. Insert component rows
      if (validComponents.length > 0) {
        const { error: compErr } = await supabase.from("assembly_record_components").insert(
          validComponents.map((c) => ({
            assembly_record_id: rec.id,
            component_item_id: c.item!.id,
            quantity_consumed: parseInt(c.quantity, 10),
          }))
        );
        if (compErr) throw compErr;
      }

      // 3. Positive movement for finished item
      const { error: posErr } = await supabase.from("inventory_movements").insert({
        organization_id: orgId,
        item_id: finishedItem.id,
        movement_type: "assembled" as const,
        quantity: qty,
        source_type: "assembly_record" as const,
        source_id: rec.id,
        created_by: user.id,
      });
      if (posErr) throw posErr;

      // 4. Negative movements for each component
      for (const c of validComponents) {
        const { error: negErr } = await supabase.from("inventory_movements").insert({
          organization_id: orgId,
          item_id: c.item!.id,
          movement_type: "consumption" as const,
          quantity: -parseInt(c.quantity, 10),
          source_type: "assembly_record" as const,
          source_id: rec.id,
          created_by: user.id,
        });
        if (negErr) throw negErr;
      }

      toast({ title: "Assembly Recorded", description: `${qty} × ${finishedItem.label} added to inventory.` });
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["assembly-records"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-quantities"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // History with component counts
  const { data: records, isLoading } = useQuery({
    queryKey: ["assembly-records", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("assembly_records")
        .select("*, inventory_items!assembly_records_finished_item_id_fkey(name)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Fetch components for expanded row
  const { data: expandedComponents } = useQuery({
    queryKey: ["assembly-components", expandedRow],
    enabled: !!expandedRow,
    queryFn: async () => {
      const { data } = await supabase
        .from("assembly_record_components")
        .select("*, inventory_items!assembly_record_components_component_item_id_fkey(name, sku)")
        .eq("assembly_record_id", expandedRow!);
      return data ?? [];
    },
  });

  const renderOption = (opt: ItemOption) => (
    <div>
      <span className="font-medium">{opt.label}</span>
      {opt.sku && <span className="ml-2 text-xs text-muted-foreground">{opt.sku}</span>}
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Assembly Records"
        description="Track manufacturing and finished goods production"
      />

      <div className="p-8 max-w-5xl space-y-8">
        {/* SECTION 1 — New Assembly */}
        {canCreate && (
          <div className="fieldcore-card p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <Hammer className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Record New Assembly</h3>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground">Finished Goods Item — This is the item being produced</Label>
                <ComboBox<ItemOption>
                  value={finishedItem}
                  onChange={(v) => setFinishedItem(v as ItemOption | null)}
                  onSearch={searchFinished}
                  placeholder="Search resale items..."
                  renderOption={renderOption}
                />
              </div>

              {finishedItem && (
                <>
                  <div className="max-w-xs">
                    <Label className="text-sm text-muted-foreground">Quantity Produced</Label>
                    <Input
                      type="number"
                      min="1"
                      value={qtyProduced}
                      onChange={(e) => setQtyProduced(e.target.value)}
                      placeholder="Enter quantity"
                    />
                  </div>

                  {/* Components */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-muted-foreground">Components Used (optional)</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addComponent}>
                        <Plus className="h-4 w-4" /> Add Component
                      </Button>
                    </div>

                    {components.map((c) => (
                      <div key={c.key} className="flex items-end gap-3 rounded-md border p-3">
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground">Component Item</Label>
                          <ComboBox<ItemOption>
                            value={c.item}
                            onChange={(v) => updateComponent(c.key, "item", v)}
                            onSearch={searchComponents}
                            placeholder="Search manufacturing inputs..."
                            renderOption={renderOption}
                          />
                        </div>
                        <div className="w-28">
                          <Label className="text-xs text-muted-foreground">Qty Consumed</Label>
                          <Input
                            type="number"
                            min="1"
                            value={c.quantity}
                            onChange={(e) => updateComponent(c.key, "quantity", e.target.value)}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => removeComponent(c.key)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div>
                    <Label className="text-sm text-muted-foreground">Notes</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Optional notes..."
                      rows={2}
                    />
                  </div>

                  <Button onClick={handleSave} disabled={isSaving || !qtyProduced}>
                    {isSaving ? "Saving..." : "Save Assembly Record"}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {/* SECTION 2 — History */}
        <div className="fieldcore-card overflow-hidden">
          <div className="border-b px-5 py-3">
            <h3 className="text-sm font-semibold text-foreground">Assembly History</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-5 py-3 w-8" />
                <th className="px-5 py-3 font-medium text-muted-foreground">Finished Item</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Qty Produced</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Components</th>
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
                <Fragment key={r.id}>
                  <tr
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setExpandedRow(expandedRow === r.id ? null : r.id)}
                  >
                    <td className="px-5 py-3 text-muted-foreground">
                      {expandedRow === r.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </td>
                    <td className="px-5 py-3 font-medium text-foreground">{r.inventory_items?.name ?? "—"}</td>
                    <td className="px-5 py-3 text-foreground">{r.quantity_produced}</td>
                    <td className="px-5 py-3 text-muted-foreground">—</td>
                    <td className="px-5 py-3 text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                  </tr>
                  {expandedRow === r.id && (
                    <tr>
                      <td colSpan={5} className="px-10 py-3 bg-muted/20">
                        {!expandedComponents || expandedComponents.length === 0 ? (
                          <p className="text-sm text-muted-foreground italic">No components recorded</p>
                        ) : (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left">
                                <th className="pb-1 font-medium text-muted-foreground">Component</th>
                                <th className="pb-1 font-medium text-muted-foreground">SKU</th>
                                <th className="pb-1 font-medium text-muted-foreground text-right">Qty Consumed</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {expandedComponents.map((c: any) => (
                                <tr key={c.id}>
                                  <td className="py-1 text-foreground">{c.inventory_items?.name ?? "—"}</td>
                                  <td className="py-1 text-muted-foreground">{c.inventory_items?.sku ?? "—"}</td>
                                  <td className="py-1 text-right text-foreground">{c.quantity_consumed}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
