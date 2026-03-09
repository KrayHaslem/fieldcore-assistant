import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface CreatedItem {
  id: string;
  name: string;
  sku: string | null;
  item_type: string;
}

interface QuickCreateItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName: string;
  /** Restrict to a specific item type, or let user choose */
  fixedItemType?: "resale" | "manufacturing_input";
  onCreated: (item: CreatedItem) => void;
}

const ITEM_TYPE_LABELS: Record<string, string> = {
  resale: "Resale (Finished Good)",
  manufacturing_input: "Manufacturing Input",
  consumable: "Consumable",
  internal_use: "Internal Use",
};

export function QuickCreateItemDialog({
  open,
  onOpenChange,
  defaultName,
  fixedItemType,
  onCreated,
}: QuickCreateItemDialogProps) {
  const { orgId } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState(defaultName);
  const [sku, setSku] = useState("");
  const [itemType, setItemType] = useState(fixedItemType ?? "resale");
  const [defaultCost, setDefaultCost] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset form when dialog opens with new defaultName
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setName(defaultName);
      setSku("");
      setItemType(fixedItemType ?? "resale");
      setDefaultCost("");
    }
    onOpenChange(isOpen);
  };

  const handleSave = async () => {
    if (!name.trim() || !orgId) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("inventory_items")
      .insert({
        name: name.trim(),
        sku: sku.trim() || null,
        item_type: itemType as any,
        default_unit_cost: defaultCost ? Number(defaultCost) : null,
        organization_id: orgId,
      })
      .select("id, name, sku, item_type")
      .single();
    setSaving(false);

    if (error) {
      toast({ title: "Error creating item", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Item created", description: `${data.name} has been added to inventory.` });
    qc.invalidateQueries({ queryKey: ["inventory-items"] });
    onCreated({
      id: data.id,
      name: data.name,
      sku: data.sku,
      item_type: data.item_type,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quick Add Inventory Item</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-sm">Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Item name" />
          </div>
          <div>
            <Label className="text-sm">SKU</Label>
            <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Optional SKU" />
          </div>
          <div>
            <Label className="text-sm">Item Type</Label>
            {fixedItemType ? (
              <Input value={ITEM_TYPE_LABELS[fixedItemType] ?? fixedItemType} disabled />
            ) : (
              <Select value={itemType} onValueChange={setItemType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ITEM_TYPE_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <Label className="text-sm">Default Unit Cost</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={defaultCost}
              onChange={(e) => setDefaultCost(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? "Creating..." : "Create Item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
