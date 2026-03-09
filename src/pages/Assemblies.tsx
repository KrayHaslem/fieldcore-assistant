import { useState, useCallback, useEffect, Fragment } from "react";
import { useLocation, Link } from "react-router-dom";
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
import { Plus, Trash2, ChevronDown, ChevronRight, Hammer, RefreshCw, AlertTriangle } from "lucide-react";
import { FormAssistantPanel } from "@/components/FormAssistantPanel";

interface ItemOption extends ComboBoxOption {
  sku: string | null;
}

interface ComponentRow {
  key: number;
  item: ItemOption | null;
  quantity: string;
}

interface BomEntry {
  component_item_id: string;
  quantity_per_unit: number;
  inventory_items: { name: string; sku: string | null } | null;
}

let rowKeyCounter = 0;

export default function Assemblies() {
  const { user, orgId, roles } = useAuth();
  const location = useLocation();
  const prefill = (location.state as any)?.prefill;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAssistant, setShowAssistant] = useState(!!prefill);

  const canCreate = roles.includes("admin") || roles.includes("procurement") || roles.includes("employee");

  // Form state
  const [finishedItem, setFinishedItem] = useState<ItemOption | null>(null);
  const [qtyProduced, setQtyProduced] = useState("");
  const [components, setComponents] = useState<ComponentRow[]>([]);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // BOM state
  const [bomData, setBomData] = useState<BomEntry[]>([]);
  const [bomLoaded, setBomLoaded] = useState(false);

  // Stock warning state
  const [stockWarningAcknowledged, setStockWarningAcknowledged] = useState(false);
  const [stockShortfalls, setStockShortfalls] = useState<{ name: string; required: number; available: number }[]>([]);

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

  // Auto-populate from BOM when finished item changes
  useEffect(() => {
    if (!finishedItem || !orgId) {
      setBomData([]);
      setBomLoaded(false);
      return;
    }
    setStockWarningAcknowledged(false);
    setStockShortfalls([]);

    (async () => {
      const { data } = await supabase
        .from("bill_of_materials")
        .select("component_item_id, quantity_per_unit, inventory_items!bill_of_materials_component_item_id_fkey(name, sku)")
        .eq("finished_item_id", finishedItem.id)
        .order("created_at");

      const entries = (data ?? []) as unknown as BomEntry[];
      setBomData(entries);

      if (entries.length > 0) {
        const qty = parseInt(qtyProduced || "1", 10) || 1;
        const rows: ComponentRow[] = entries.map((b) => ({
          key: ++rowKeyCounter,
          item: {
            id: b.component_item_id,
            label: b.inventory_items?.name ?? "Unknown",
            sku: b.inventory_items?.sku ?? null,
          },
          quantity: String(Math.round(b.quantity_per_unit * qty)),
        }));
        setComponents(rows);
        setBomLoaded(true);
      } else {
        setBomLoaded(false);
      }
    })();
  }, [finishedItem?.id, orgId]);

  // Recalculate component quantities from BOM
  const recalculateFromBom = () => {
    const qty = parseInt(qtyProduced, 10);
    if (isNaN(qty) || qty <= 0 || bomData.length === 0) return;
    const rows: ComponentRow[] = bomData.map((b) => ({
      key: ++rowKeyCounter,
      item: {
        id: b.component_item_id,
        label: b.inventory_items?.name ?? "Unknown",
        sku: b.inventory_items?.sku ?? null,
      },
      quantity: String(Math.round(b.quantity_per_unit * qty)),
    }));
    setComponents(rows);
    setStockWarningAcknowledged(false);
    setStockShortfalls([]);
    toast({ title: "Components recalculated from BOM" });
  };

  const addComponent = () => {
    setComponents((prev) => [...prev, { key: ++rowKeyCounter, item: null, quantity: "" }]);
  };

  const removeComponent = (key: number) => {
    setComponents((prev) => prev.filter((c) => c.key !== key));
    setStockWarningAcknowledged(false);
  };

  const updateComponent = (key: number, field: "item" | "quantity", value: any) => {
    setComponents((prev) =>
      prev.map((c) => (c.key === key ? { ...c, [field]: value } : c))
    );
    setStockWarningAcknowledged(false);
  };

  const resetForm = () => {
    setFinishedItem(null);
    setQtyProduced("");
    setComponents([]);
    setNotes("");
    setBomData([]);
    setBomLoaded(false);
    setStockWarningAcknowledged(false);
    setStockShortfalls([]);
  };

  const handleSave = async () => {
    if (!finishedItem || !user || !orgId) return;
    const qty = parseInt(qtyProduced, 10);
    if (isNaN(qty) || qty <= 0) {
      toast({ title: "Invalid quantity", description: "Enter a positive number.", variant: "destructive" });
      return;
    }

    const validComponents = components.filter((c) => c.item);
    for (const c of validComponents) {
      const cq = parseInt(c.quantity, 10);
      if (isNaN(cq) || cq <= 0) {
        toast({ title: "Invalid component quantity", description: `Enter a valid quantity for ${c.item!.label}.`, variant: "destructive" });
        return;
      }
    }

    // Stock validation
    if (validComponents.length > 0 && !stockWarningAcknowledged) {
      try {
        const itemIds = validComponents.map((c) => c.item!.id);
        const { data: stockData } = await supabase.rpc("get_component_stock", {
          _org_id: orgId,
          _item_ids: itemIds,
        });
        const stockMap = new Map((stockData ?? []).map((s: any) => [s.item_id, Number(s.on_hand)]));
        const shortfalls: typeof stockShortfalls = [];
        for (const c of validComponents) {
          const required = parseInt(c.quantity, 10);
          const available = stockMap.get(c.item!.id) ?? 0;
          if (required > available) {
            shortfalls.push({ name: c.item!.label, required, available });
          }
        }
        if (shortfalls.length > 0) {
          setStockShortfalls(shortfalls);
          setStockWarningAcknowledged(true);
          toast({
            title: "Stock Warning",
            description: `${shortfalls.length} component(s) have insufficient stock. Click save again to proceed anyway.`,
            variant: "destructive",
          });
          return;
        }
      } catch {
        // If RPC fails, proceed without validation
      }
    }

    setIsSaving(true);
    try {
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
        .select("*, inventory_items!assembly_records_finished_item_id_fkey(name), assembly_record_components(id)")
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

  const handleAssistantIntent = (intent: Record<string, any>): string => {
    const updates: string[] = [];
    if (intent.item_name) {
      supabase.from("inventory_items").select("id, name, sku").eq("item_type", "resale").ilike("name", `%${intent.item_name}%`).limit(1)
        .then(({ data }) => {
          if (data && data[0]) setFinishedItem({ id: data[0].id, label: data[0].name, sku: data[0].sku });
        });
      updates.push(`Setting finished item to "${intent.item_name}"`);
    }
    if (intent.quantity) { setQtyProduced(String(intent.quantity)); updates.push(`Set quantity to ${intent.quantity}`); }
    if (intent.components && Array.isArray(intent.components)) {
      for (const comp of intent.components) {
        if (comp.name) {
          supabase.from("inventory_items").select("id, name, sku").eq("item_type", "manufacturing_input").ilike("name", `%${comp.name}%`).limit(1)
            .then(({ data }) => {
              if (data && data[0]) {
                setComponents((prev) => [
                  ...prev,
                  {
                    key: ++rowKeyCounter,
                    item: { id: data[0].id, label: data[0].name, sku: data[0].sku },
                    quantity: String(comp.quantity ?? 1),
                  },
                ]);
              }
            });
          updates.push(`Adding component "${comp.name}"`);
        }
      }
    }
    return updates.length > 0 ? `I've updated the form: ${updates.join(". ")}.` : "I couldn't find specific fields to update.";
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0">
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
                  <div className="flex items-end gap-3">
                    <div className="max-w-xs flex-1">
                      <Label className="text-sm text-muted-foreground">Quantity Produced</Label>
                      <Input
                        type="number"
                        min="1"
                        value={qtyProduced}
                        onChange={(e) => { setQtyProduced(e.target.value); setStockWarningAcknowledged(false); }}
                        placeholder="Enter quantity"
                      />
                    </div>
                    {bomLoaded && qtyProduced && (
                      <Button type="button" variant="outline" size="sm" onClick={recalculateFromBom}>
                        <RefreshCw className="h-4 w-4" /> Recalculate from BOM
                      </Button>
                    )}
                  </div>

                  {/* BOM info banner */}
                  {bomLoaded && (
                    <div className="rounded-md border border-primary/20 bg-primary/5 px-4 py-2 text-sm text-primary">
                      Components auto-populated from saved BOM. You can adjust quantities or add/remove items.
                    </div>
                  )}
                  {!bomLoaded && finishedItem && bomData.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No BOM defined for this item.{" "}
                      <Link to="/settings?tab=bom" className="text-primary underline">Set up a Bill of Materials</Link>
                    </p>
                  )}

                  {/* Stock warning banner */}
                  {stockShortfalls.length > 0 && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm space-y-1">
                      <div className="flex items-center gap-2 text-destructive font-medium">
                        <AlertTriangle className="h-4 w-4" /> Insufficient Stock
                      </div>
                      {stockShortfalls.map((s, i) => (
                        <p key={i} className="text-muted-foreground">
                          {s.name}: need {s.required}, have {s.available}
                        </p>
                      ))}
                    </div>
                  )}

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

                  <Button onClick={handleSave} disabled={isSaving || !qtyProduced} variant={stockWarningAcknowledged ? "destructive" : "default"}>
                    {isSaving ? "Saving..." : stockWarningAcknowledged ? "Save Anyway (Stock Warning)" : "Save Assembly Record"}
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
              {records?.map((r: any) => {
                const compCount = r.assembly_record_components?.length ?? 0;
                return (
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
                      <td className="px-5 py-3 text-muted-foreground">
                        {compCount > 0 ? `${compCount} component${compCount > 1 ? "s" : ""}` : "No components"}
                      </td>
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
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      </div>

      {showAssistant && prefill && (
        <FormAssistantPanel
          commandText={prefill.raw || prefill.command || "AI command"}
          formContext="Assembly Record form. Fields include the finished goods resale item being produced, quantity produced, and the manufacturing input components consumed with their quantities. You can also return a 'components' array with {name, quantity} objects."
          onIntentReceived={handleAssistantIntent}
          onClose={() => setShowAssistant(false)}
        />
      )}
    </div>
  );
}
