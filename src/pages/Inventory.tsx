import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ComboBox, type ComboBoxOption } from "@/components/ComboBox";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

const ITEM_TYPES = [
  { value: "resale", label: "Resale" },
  { value: "manufacturing_input", label: "Manufacturing Input" },
  { value: "internal_use", label: "Internal Use" },
  { value: "consumable", label: "Consumable" },
] as const;

const SHOWS_REORDER = ["resale", "manufacturing_input"];

export default function Inventory() {
  const { orgId } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    sku: "",
    item_type: "resale" as string,
    default_unit_cost: "",
    reorder_point: "",
    description: "",
  });
  const [supplier, setSupplier] = useState<ComboBoxOption | null>(null);

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

  const resetForm = () => {
    setForm({ name: "", sku: "", item_type: "resale", default_unit_cost: "", reorder_point: "", description: "" });
    setSupplier(null);
  };

  const searchSuppliers = async (query: string): Promise<ComboBoxOption[]> => {
    const { data } = await supabase
      .from("suppliers")
      .select("id, name")
      .ilike("name", `%${query}%`)
      .limit(20);
    return (data ?? []).map((s) => ({ id: s.id, label: s.name }));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !orgId) return;
    setSaving(true);
    const { error } = await supabase.from("inventory_items").insert({
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      item_type: form.item_type as any,
      default_unit_cost: form.default_unit_cost ? Number(form.default_unit_cost) : null,
      reorder_point: SHOWS_REORDER.includes(form.item_type) && form.reorder_point ? Number(form.reorder_point) : null,
      preferred_supplier_id: supplier?.id || null,
      description: form.description.trim() || null,
      organization_id: orgId,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Item created" });
    qc.invalidateQueries({ queryKey: ["inventory-items"] });
    setOpen(false);
    resetForm();
  };

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Track items, stock levels, and classifications"
        actions={
          <Button onClick={() => setOpen(true)}>
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

      {/* Add Item Dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Inventory Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Item Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Widget A" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>SKU</Label>
                <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="Optional" />
              </div>
              <div className="space-y-1.5">
                <Label>Item Type</Label>
                <Select value={form.item_type} onValueChange={(v) => setForm({ ...form, item_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ITEM_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Default Unit Cost</Label>
                <Input type="number" min="0" step="0.01" value={form.default_unit_cost} onChange={(e) => setForm({ ...form, default_unit_cost: e.target.value })} placeholder="0.00" />
              </div>
              {SHOWS_REORDER.includes(form.item_type) && (
                <div className="space-y-1.5">
                  <Label>Reorder Point</Label>
                  <Input type="number" min="0" value={form.reorder_point} onChange={(e) => setForm({ ...form, reorder_point: e.target.value })} placeholder="0" />
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Preferred Supplier</Label>
              <ComboBox value={supplier} onChange={setSupplier} onSearch={searchSuppliers} placeholder="Search suppliers..." />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional notes" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? "Saving..." : "Create Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
