import { useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { ComboBox, type ComboBoxOption } from "@/components/ComboBox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { FormAssistantPanel } from "@/components/FormAssistantPanel";

interface ItemOption extends ComboBoxOption {
  sku: string | null;
  onHand: number;
}

interface LineItem {
  key: number;
  item: ItemOption | null;
  quantity: string;
  unitPrice: string;
}

let rowKey = 0;

export default function CreateSalesOrder() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = (location.state as any)?.prefill;
  const { user, orgId } = useAuth();
  const { toast } = useToast();
  const [showAssistant, setShowAssistant] = useState(!!prefill);

  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItem[]>([{ key: ++rowKey, item: null, quantity: "", unitPrice: "" }]);
  const [isSaving, setIsSaving] = useState(false);

  const searchItems = useCallback(async (query: string): Promise<ItemOption[]> => {
    const { data: items } = await supabase
      .from("inventory_items")
      .select("id, name, sku")
      .eq("item_type", "resale")
      .ilike("name", `%${query}%`)
      .limit(20);

    if (!items || items.length === 0) return [];

    // Fetch on-hand quantities
    const ids = items.map((i) => i.id);
    const { data: movements } = await supabase
      .from("inventory_movements")
      .select("item_id, quantity")
      .in("item_id", ids);

    const qtyMap: Record<string, number> = {};
    (movements ?? []).forEach((m) => {
      qtyMap[m.item_id] = (qtyMap[m.item_id] || 0) + m.quantity;
    });

    return items.map((i) => ({
      id: i.id,
      label: i.name,
      sku: i.sku,
      onHand: qtyMap[i.id] || 0,
    }));
  }, []);

  const addLine = () => setLines((p) => [...p, { key: ++rowKey, item: null, quantity: "", unitPrice: "" }]);
  const removeLine = (key: number) => setLines((p) => p.filter((l) => l.key !== key));
  const updateLine = (key: number, field: keyof LineItem, value: any) => {
    setLines((p) => p.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  };

  const lineTotal = (l: LineItem) => {
    const q = parseFloat(l.quantity) || 0;
    const p = parseFloat(l.unitPrice) || 0;
    return q * p;
  };
  const grandTotal = lines.reduce((s, l) => s + lineTotal(l), 0);

  const generateSoNumber = () => {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return `SO-${yy}${mm}-${code}`;
  };

  const handleSave = async (status: "quote" | "order") => {
    if (!customerName.trim()) {
      toast({ title: "Missing customer", description: "Enter a customer name.", variant: "destructive" });
      return;
    }
    const validLines = lines.filter((l) => l.item);
    if (validLines.length === 0) {
      toast({ title: "No items", description: "Add at least one line item.", variant: "destructive" });
      return;
    }
    for (const l of validLines) {
      if (!parseFloat(l.quantity) || !parseFloat(l.unitPrice)) {
        toast({ title: "Invalid line", description: `Complete quantity and price for ${l.item!.label}.`, variant: "destructive" });
        return;
      }
    }

    setIsSaving(true);
    try {
      const soNumber = generateSoNumber();
      const { data: so, error: soErr } = await supabase
        .from("sales_orders")
        .insert({
          organization_id: orgId!,
          so_number: soNumber,
          customer_name: customerName.trim(),
          status,
          total_amount: grandTotal,
          notes: notes || null,
          created_by: user!.id,
        })
        .select("id")
        .single();
      if (soErr) throw soErr;

      const { error: liErr } = await supabase.from("sales_order_items").insert(
        validLines.map((l) => ({
          sales_order_id: so.id,
          organization_id: orgId!,
          item_id: l.item!.id,
          quantity: parseInt(l.quantity, 10),
          unit_price: parseFloat(l.unitPrice),
        }))
      );
      if (liErr) throw liErr;

      toast({ title: "Sales Order Created", description: `${soNumber} saved as ${status}.` });
      navigate(`/sales/${so.id}`);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAssistantIntent = (intent: Record<string, any>): string => {
    const updates: string[] = [];
    if (intent.customer) { setCustomerName(intent.customer); updates.push(`Set customer to "${intent.customer}"`); }
    if (intent.items && Array.isArray(intent.items)) {
      for (const ii of intent.items) {
        supabase.from("inventory_items").select("id, name, sku").eq("item_type", "resale").ilike("name", `%${ii.name}%`).limit(1)
          .then(({ data: items }) => {
            if (items && items[0]) {
              const m = items[0];
              setLines((prev) => {
                const empty = prev.find((l) => !l.item);
                const nl = { key: ++rowKey, item: { id: m.id, label: m.name, sku: m.sku, onHand: 0 }, quantity: String(ii.quantity || 1), unitPrice: "" };
                if (empty) return prev.map((l) => (l.key === empty.key ? nl : l));
                return [...prev, nl];
              });
            }
          });
        updates.push(`Adding ${ii.quantity || 1}× ${ii.name}`);
      }
    }
    return updates.length > 0 ? `I've updated the form: ${updates.join(". ")}.` : "I couldn't find specific fields to update.";
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0">
        <PageHeader
          title="New Sales Order"
          description="Create a quote or sales order"
          actions={
            <Button variant="outline" size="sm" onClick={() => navigate("/sales")}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          }
        />
        <div className="p-8 max-w-4xl space-y-6">
          <div className="fieldcore-card p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-muted-foreground">Customer Name *</Label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Enter customer name" />
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." rows={1} />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="fieldcore-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Line Items</h3>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="h-4 w-4" /> Add Item
              </Button>
            </div>

            {lines.map((l) => (
              <div key={l.key} className="flex items-end gap-3 rounded-md border p-3">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Item (resale)</Label>
                  <ComboBox<ItemOption>
                    value={l.item}
                    onChange={(v) => updateLine(l.key, "item", v)}
                    onSearch={searchItems}
                    placeholder="Search items..."
                    renderOption={(opt: ItemOption) => (
                      <div className="flex justify-between w-full">
                        <span className="font-medium">{opt.label}</span>
                        <span className="text-xs text-muted-foreground ml-2">On hand: {opt.onHand}</span>
                      </div>
                    )}
                  />
                </div>
                <div className="w-24">
                  <Label className="text-xs text-muted-foreground">Qty</Label>
                  <Input type="number" min="1" value={l.quantity} onChange={(e) => updateLine(l.key, "quantity", e.target.value)} />
                </div>
                <div className="w-28">
                  <Label className="text-xs text-muted-foreground">Unit Price</Label>
                  <Input type="number" min="0" step="0.01" value={l.unitPrice} onChange={(e) => updateLine(l.key, "unitPrice", e.target.value)} />
                </div>
                <div className="w-24 text-right">
                  <Label className="text-xs text-muted-foreground">Total</Label>
                  <p className="h-10 flex items-center justify-end text-sm font-medium text-foreground">${lineTotal(l).toFixed(2)}</p>
                </div>
                <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeLine(l.key)} disabled={lines.length === 1}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <div className="flex justify-end pt-2 border-t">
              <p className="text-sm font-semibold text-foreground">Total: ${grandTotal.toFixed(2)}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => handleSave("quote")} disabled={isSaving}>
              Save as Quote
            </Button>
            <Button onClick={() => handleSave("order")} disabled={isSaving}>
              {isSaving ? "Saving..." : "Create Sales Order"}
            </Button>
          </div>
        </div>
      </div>

      {showAssistant && prefill && (
        <FormAssistantPanel
          commandText={prefill.raw || prefill.command || "AI command"}
          onIntentReceived={handleAssistantIntent}
          onClose={() => setShowAssistant(false)}
        />
      )}
    </div>
  );
}
        title="New Sales Order"
        description="Create a quote or sales order"
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate("/sales")}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        }
      />
      <div className="flex-1 min-w-0">
        <div className="fieldcore-card p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm text-muted-foreground">Customer Name *</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Enter customer name" />
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." rows={1} />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="fieldcore-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Line Items</h3>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="h-4 w-4" /> Add Item
            </Button>
          </div>

          {lines.map((l) => (
            <div key={l.key} className="flex items-end gap-3 rounded-md border p-3">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Item (resale)</Label>
                <ComboBox<ItemOption>
                  value={l.item}
                  onChange={(v) => updateLine(l.key, "item", v)}
                  onSearch={searchItems}
                  placeholder="Search items..."
                  renderOption={(opt: ItemOption) => (
                    <div className="flex justify-between w-full">
                      <span className="font-medium">{opt.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">On hand: {opt.onHand}</span>
                    </div>
                  )}
                />
              </div>
              <div className="w-24">
                <Label className="text-xs text-muted-foreground">Qty</Label>
                <Input type="number" min="1" value={l.quantity} onChange={(e) => updateLine(l.key, "quantity", e.target.value)} />
              </div>
              <div className="w-28">
                <Label className="text-xs text-muted-foreground">Unit Price</Label>
                <Input type="number" min="0" step="0.01" value={l.unitPrice} onChange={(e) => updateLine(l.key, "unitPrice", e.target.value)} />
              </div>
              <div className="w-24 text-right">
                <Label className="text-xs text-muted-foreground">Total</Label>
                <p className="h-10 flex items-center justify-end text-sm font-medium text-foreground">${lineTotal(l).toFixed(2)}</p>
              </div>
              <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeLine(l.key)} disabled={lines.length === 1}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <div className="flex justify-end pt-2 border-t">
            <p className="text-sm font-semibold text-foreground">Total: ${grandTotal.toFixed(2)}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => handleSave("quote")} disabled={isSaving}>
            Save as Quote
          </Button>
          <Button onClick={() => handleSave("order")} disabled={isSaving}>
            {isSaving ? "Saving..." : "Create Sales Order"}
          </Button>
        </div>
      </div>
      </div>

      {showAssistant && prefill && (
        <FormAssistantPanel
          commandText={prefill.raw || prefill.command || "AI command"}
          onIntentReceived={handleAssistantIntent}
          onClose={() => setShowAssistant(false)}
        />
      )}
    </div>
  );
}
