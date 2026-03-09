import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ComboBox, type ComboBoxOption } from "@/components/ComboBox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import { QuickCreateItemDialog, type CreatedItem } from "@/components/QuickCreateItemDialog";

interface ItemOption extends ComboBoxOption {
  sku: string | null;
}

export function BomSettingsTab() {
  const { orgId } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedItem, setSelectedItem] = useState<ItemOption | null>(null);
  const [addComponent, setAddComponent] = useState<ItemOption | null>(null);
  const [addQty, setAddQty] = useState("1");
  const [addNotes, setAddNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Quick-create dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDialogName, setCreateDialogName] = useState("");
  const [createDialogType, setCreateDialogType] = useState<"resale" | "manufacturing_input">("resale");
  const [createDialogTarget, setCreateDialogTarget] = useState<"finished" | "component">("finished");

  // Search finished goods (resale items)
  const searchFinished = useCallback(async (query: string): Promise<ItemOption[]> => {
    const { data } = await supabase
      .from("inventory_items")
      .select("id, name, sku")
      .eq("item_type", "resale")
      .ilike("name", `%${query}%`)
      .limit(20);
    return (data ?? []).map((i) => ({ id: i.id, label: i.name, sku: i.sku }));
  }, []);

  // Search manufacturing inputs
  const searchComponents = useCallback(async (query: string): Promise<ItemOption[]> => {
    const { data } = await supabase
      .from("inventory_items")
      .select("id, name, sku")
      .eq("item_type", "manufacturing_input")
      .ilike("name", `%${query}%`)
      .limit(20);
    return (data ?? []).map((i) => ({ id: i.id, label: i.name, sku: i.sku }));
  }, []);

  // Fetch BOM for selected item
  const { data: bomEntries, isLoading } = useQuery({
    queryKey: ["bom", orgId, selectedItem?.id],
    enabled: !!orgId && !!selectedItem,
    queryFn: async () => {
      const { data } = await supabase
        .from("bill_of_materials")
        .select("*, inventory_items!bill_of_materials_component_item_id_fkey(name, sku)")
        .eq("finished_item_id", selectedItem!.id)
        .order("created_at");
      return data ?? [];
    },
  });

  const handleAdd = async () => {
    if (!selectedItem || !addComponent || !orgId) return;
    const qty = parseFloat(addQty);
    if (isNaN(qty) || qty <= 0) {
      toast({ title: "Invalid quantity", variant: "destructive" });
      return;
    }
    // Check duplicate
    if (bomEntries?.some((b: any) => b.component_item_id === addComponent.id)) {
      toast({ title: "Component already in BOM", description: "Update the existing entry instead.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("bill_of_materials").insert({
      organization_id: orgId,
      finished_item_id: selectedItem.id,
      component_item_id: addComponent.id,
      quantity_per_unit: qty,
      notes: addNotes || null,
    } as any);
    setSaving(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Component added to BOM" });
    setAddComponent(null);
    setAddQty("1");
    setAddNotes("");
    qc.invalidateQueries({ queryKey: ["bom"] });
  };

  const handleUpdateQty = async (id: string, newQty: string) => {
    const qty = parseFloat(newQty);
    if (isNaN(qty) || qty <= 0) return;
    await supabase.from("bill_of_materials").update({ quantity_per_unit: qty } as any).eq("id", id);
    qc.invalidateQueries({ queryKey: ["bom"] });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Remove this component from the BOM?")) return;
    await supabase.from("bill_of_materials").delete().eq("id", id);
    toast({ title: "Component removed" });
    qc.invalidateQueries({ queryKey: ["bom"] });
  };

  const renderOption = (opt: ItemOption) => (
    <div>
      <span className="font-medium">{opt.label}</span>
      {opt.sku && <span className="ml-2 text-xs text-muted-foreground">{opt.sku}</span>}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Select finished item */}
      <div className="fieldcore-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Select Finished Good</h3>
            <p className="text-xs text-muted-foreground">Choose a resale item to manage its bill of materials (recipe).</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCreateDialogName("");
              setCreateDialogType("resale");
              setCreateDialogTarget("finished");
              setCreateDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Add New Item
          </Button>
        </div>
        <div className="max-w-md">
          <ComboBox<ItemOption>
            value={selectedItem}
            onChange={(v) => setSelectedItem(v as ItemOption | null)}
            onSearch={searchFinished}
            placeholder="Search resale items..."
            renderOption={renderOption}
            allowCreate
            createLabel="Add new item"
            onCreateNew={(name) => {
              setCreateDialogName(name);
              setCreateDialogType("resale");
              setCreateDialogTarget("finished");
              setCreateDialogOpen(true);
            }}
          />
        </div>
      </div>

      {/* BOM detail */}
      {selectedItem && (
        <div className="fieldcore-card">
          <div className="border-b px-5 py-3">
            <h3 className="text-sm font-semibold text-foreground">
              BOM for {selectedItem.label}
              {selectedItem.sku && <span className="ml-2 text-xs text-muted-foreground font-normal">{selectedItem.sku}</span>}
            </h3>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-5 py-2 font-medium text-muted-foreground">Component</th>
                <th className="px-5 py-2 font-medium text-muted-foreground">SKU</th>
                <th className="px-5 py-2 font-medium text-muted-foreground w-32">Qty Per Unit</th>
                <th className="px-5 py-2 font-medium text-muted-foreground">Notes</th>
                <th className="px-5 py-2 w-12" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && (
                <tr><td colSpan={5} className="px-5 py-6 text-center text-muted-foreground">Loading...</td></tr>
              )}
              {bomEntries?.map((b: any) => (
                <tr key={b.id} className="hover:bg-muted/30">
                  <td className="px-5 py-2 font-medium text-foreground">{b.inventory_items?.name ?? "—"}</td>
                  <td className="px-5 py-2 text-muted-foreground">{b.inventory_items?.sku ?? "—"}</td>
                  <td className="px-5 py-2">
                    <Input
                      type="number"
                      step="0.0001"
                      min="0.0001"
                      defaultValue={b.quantity_per_unit}
                      className="h-8 w-28"
                      onBlur={(e) => handleUpdateQty(b.id, e.target.value)}
                    />
                  </td>
                  <td className="px-5 py-2 text-muted-foreground text-xs">{b.notes ?? "—"}</td>
                  <td className="px-5 py-2">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(b.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
              {!isLoading && (!bomEntries || bomEntries.length === 0) && (
                <tr><td colSpan={5} className="px-5 py-6 text-center text-muted-foreground">No components in BOM yet</td></tr>
              )}
            </tbody>
          </table>

          {/* Add component form */}
          <div className="border-t px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Add Component</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCreateDialogName("");
                  setCreateDialogType("manufacturing_input");
                  setCreateDialogTarget("component");
                  setCreateDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> Add New Component
              </Button>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <ComboBox<ItemOption>
                  value={addComponent}
                  onChange={(v) => setAddComponent(v as ItemOption | null)}
                  onSearch={searchComponents}
                  placeholder="Search manufacturing inputs..."
                  renderOption={renderOption}
                  allowCreate
                  createLabel="Add new component"
                  onCreateNew={(name) => {
                    setCreateDialogName(name);
                    setCreateDialogType("manufacturing_input");
                    setCreateDialogTarget("component");
                    setCreateDialogOpen(true);
                  }}
                />
              </div>
              <div className="w-28">
                <Label className="text-xs text-muted-foreground">Qty/Unit</Label>
                <Input type="number" step="0.0001" min="0.0001" value={addQty} onChange={(e) => setAddQty(e.target.value)} />
              </div>
              <div className="w-40">
                <Label className="text-xs text-muted-foreground">Notes</Label>
                <Input value={addNotes} onChange={(e) => setAddNotes(e.target.value)} placeholder="Optional" />
              </div>
              <Button size="sm" onClick={handleAdd} disabled={saving || !addComponent}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </div>
        </div>
      )}

      <QuickCreateItemDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        defaultName={createDialogName}
        fixedItemType={createDialogType}
        onCreated={(item: CreatedItem) => {
          const option: ItemOption = { id: item.id, label: item.name, sku: item.sku };
          if (createDialogTarget === "finished") {
            setSelectedItem(option);
          } else {
            setAddComponent(option);
          }
        }}
      />
    </div>
  );
}
