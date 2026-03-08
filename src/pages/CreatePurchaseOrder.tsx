import { useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FormAssistantPanel } from "@/components/FormAssistantPanel";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { ComboBox, type ComboBoxOption } from "@/components/ComboBox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type InventoryType = "resale" | "manufacturing_input" | "internal_use" | "consumable";

interface SupplierOption extends ComboBoxOption {
  contact_email?: string | null;
  contact_name?: string | null;
}

interface DepartmentOption extends ComboBoxOption {}

interface ItemOption extends ComboBoxOption {
  item_type?: InventoryType;
  default_unit_cost?: number | null;
  sku?: string | null;
}

interface UnitOption extends ComboBoxOption {
  unit_number?: string;
}

interface LineItem {
  id: string;
  item: ItemOption | null;
  quantity: string;
  unit_cost: string;
  item_type: InventoryType;
  unit: UnitOption | null;
}

function emptyLineItem(): LineItem {
  return {
    id: String(Date.now()),
    item: null,
    quantity: "",
    unit_cost: "",
    item_type: "resale",
    unit: null,
  };
}

export default function CreatePurchaseOrder() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = (location.state as any)?.prefill;
  const { orgId, user } = useAuth();
  const { toast } = useToast();
  const [showAssistant, setShowAssistant] = useState(!!prefill);

  const [supplier, setSupplier] = useState<SupplierOption | null>(null);
  const [department, setDepartment] = useState<DepartmentOption | null>(null);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([emptyLineItem()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Inline create modals
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierEmail, setNewSupplierEmail] = useState("");
  const [supplierModalError, setSupplierModalError] = useState("");

  const [showItemModal, setShowItemModal] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemType, setNewItemType] = useState<InventoryType>("resale");
  const [newItemSku, setNewItemSku] = useState("");
  const [itemModalLineId, setItemModalLineId] = useState<string | null>(null);

  const [showUnitModal, setShowUnitModal] = useState(false);
  const [newUnitNumber, setNewUnitNumber] = useState("");
  const [unitModalLineId, setUnitModalLineId] = useState<string | null>(null);

  // Search functions
  const searchSuppliers = useCallback(
    async (query: string): Promise<SupplierOption[]> => {
      const { data } = await supabase
        .from("suppliers")
        .select("id, name, contact_email, contact_name")
        .ilike("name", `%${query}%`)
        .limit(20);
      return (data ?? []).map((s) => ({ ...s, label: s.name }));
    },
    []
  );

  const searchDepartments = useCallback(
    async (query: string): Promise<DepartmentOption[]> => {
      const { data } = await supabase
        .from("departments")
        .select("id, name")
        .ilike("name", `%${query}%`)
        .limit(20);
      return (data ?? []).map((d) => ({ ...d, label: d.name }));
    },
    []
  );

  const searchItems = useCallback(
    async (query: string): Promise<ItemOption[]> => {
      const { data } = await supabase
        .from("inventory_items")
        .select("id, name, item_type, default_unit_cost, sku")
        .ilike("name", `%${query}%`)
        .limit(20);
      return (data ?? []).map((i) => ({
        ...i,
        label: i.sku ? `${i.name} (${i.sku})` : i.name,
      }));
    },
    []
  );

  const searchUnits = useCallback(
    async (query: string): Promise<UnitOption[]> => {
      const { data } = await supabase
        .from("units")
        .select("id, unit_number, description")
        .ilike("unit_number", `%${query}%`)
        .limit(20);
      return (data ?? []).map((u) => ({
        ...u,
        label: u.description
          ? `${u.unit_number} - ${u.description}`
          : u.unit_number,
      }));
    },
    []
  );

  // Line item management
  const addLineItem = () => setItems((prev) => [...prev, emptyLineItem()]);

  const removeLineItem = (id: string) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateLineItem = (id: string, updates: Partial<LineItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const calculateTotal = () =>
    items.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const cost = parseFloat(item.unit_cost) || 0;
      return sum + qty * cost;
    }, 0);

  // Inline create handlers
  const handleCreateSupplier = async () => {
    setSupplierModalError("");
    if (!newSupplierName.trim()) {
      setSupplierModalError("Supplier name is required");
      return;
    }
    const { data, error: err } = await supabase
      .from("suppliers")
      .insert({
        name: newSupplierName.trim(),
        contact_email: newSupplierEmail.trim() || null,
        organization_id: orgId!,
      })
      .select()
      .single();
    if (err) {
      setSupplierModalError(err.message);
      return;
    }
    setSupplier({ ...data, label: data.name });
    setShowSupplierModal(false);
    setNewSupplierName("");
    setNewSupplierEmail("");
  };

  const handleCreateItem = async () => {
    if (!newItemName.trim()) return;
    const { data, error: err } = await supabase
      .from("inventory_items")
      .insert({
        name: newItemName.trim(),
        item_type: newItemType,
        sku: newItemSku.trim() || null,
        organization_id: orgId!,
      })
      .select()
      .single();
    if (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      return;
    }
    if (itemModalLineId) {
      updateLineItem(itemModalLineId, {
        item: {
          ...data,
          label: data.sku ? `${data.name} (${data.sku})` : data.name,
        },
        item_type: data.item_type as InventoryType,
        unit_cost: data.default_unit_cost ? String(data.default_unit_cost) : "",
      });
    }
    setShowItemModal(false);
    setNewItemName("");
    setNewItemSku("");
  };

  const handleCreateUnit = async () => {
    if (!newUnitNumber.trim()) return;
    const { data, error: err } = await supabase
      .from("units")
      .insert({
        unit_number: newUnitNumber.trim(),
        organization_id: orgId!,
      })
      .select()
      .single();
    if (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      return;
    }
    if (unitModalLineId) {
      updateLineItem(unitModalLineId, {
        unit: { ...data, label: data.unit_number },
      });
    }
    setShowUnitModal(false);
    setNewUnitNumber("");
  };

  // Generate PO number
  const generatePoNumber = () => {
    const now = new Date();
    const y = now.getFullYear().toString().slice(-2);
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const rand = Math.floor(Math.random() * 9000 + 1000);
    return `PO-${y}${m}-${rand}`;
  };

  // Validation
  const getValidationError = (): string | null => {
    if (!supplier) return "Please select a supplier";
    const validItems = items.filter((i) => i.item);
    if (validItems.length === 0) return "Please add at least one line item";
    for (const item of validItems) {
      if (item.item_type === "internal_use" && !item.unit) {
        return `Line item "${item.item?.label}" requires a unit number for internal use items`;
      }
    }
    return null;
  };

  // Submit
  const handleSubmit = async (submitForApproval: boolean) => {
    setError("");
    const validationError = getValidationError();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    const validItems = items.filter((i) => i.item);
    const totalAmount = calculateTotal();
    const poNumber = generatePoNumber();

    try {
      // Check approval rule at submit time (source of truth)
      let autoApprove = !submitForApproval; // draft = no approval needed
      let rule: any = null;

      if (submitForApproval) {
        const { data: ruleData } = await supabase.rpc("get_approval_rule", {
          _org_id: orgId!,
          _department_id: department?.id ?? '00000000-0000-0000-0000-000000000000',
          _total_amount: totalAmount,
        });
        rule = ruleData?.[0];
        autoApprove = !rule || rule.auto_approve === true;
      }

      // Create PO
      const { data: po, error: poErr } = await supabase
        .from("purchase_orders")
        .insert({
          po_number: poNumber,
          supplier_id: supplier!.id,
          department_id: department?.id || null,
          notes: notes.trim() || null,
          total_amount: totalAmount,
          created_by: user!.id,
          organization_id: orgId!,
          status: !submitForApproval
            ? "draft"
            : autoApprove
            ? "approved"
            : "submitted",
          approved_by: autoApprove && submitForApproval ? user!.id : null,
          approved_at: autoApprove && submitForApproval ? new Date().toISOString() : null,
          required_approver_role: !submitForApproval || autoApprove
            ? null
            : rule?.required_role || null,
          assigned_approver_id: !submitForApproval || autoApprove
            ? null
            : rule?.approver_user_id || null,
          rule_is_department_scoped: !submitForApproval || autoApprove
            ? false
            : rule?.rule_is_department_scoped ?? false,
        })
        .select()
        .single();

      if (poErr) throw poErr;

      // Create line items
      const lineItemInserts = validItems.map((item) => ({
        purchase_order_id: po.id,
        item_id: item.item!.id,
        quantity: parseFloat(item.quantity) || 1,
        unit_cost: parseFloat(item.unit_cost) || 0,
        item_type: item.item_type,
        unit_id: item.unit?.id || null,
        organization_id: orgId!,
      }));

      const { error: itemsErr } = await supabase
        .from("purchase_order_items")
        .insert(lineItemInserts);

      if (itemsErr) throw itemsErr;

      if (!submitForApproval) {
        toast({ title: "Draft Saved", description: `${poNumber} saved as draft.` });
        navigate("/purchase-orders");
      } else if (autoApprove) {
        toast({ title: "Purchase Order Created", description: `${poNumber} approved automatically.` });
        navigate(`/purchase-orders/${po.id}`);
      } else {
        toast({ title: "Submitted for Approval", description: `${poNumber} requires ${rule?.required_role} approval.` });
        navigate("/purchase-orders");
      }
    } catch (err: any) {
      setError(err.message || "Failed to create purchase order");
    } finally {
      setIsSubmitting(false);
    }
  };

  const total = calculateTotal();

  // Approval preview
  const { data: approvalPreview } = useQuery({
    queryKey: ["approval-preview", orgId, department?.id ?? null, total],
    enabled: !!orgId && total > 0,
    queryFn: async () => {
      const { data } = await supabase.rpc("get_approval_rule", {
        _org_id: orgId!,
        _department_id: department?.id ?? '00000000-0000-0000-0000-000000000000',
        _total_amount: total,
      });
      return data?.[0] ?? null;
    },
  });

  const requiresApproval = total > 0
    && approvalPreview !== null
    && approvalPreview.auto_approve === false;

  const handleAssistantIntent = (intent: Record<string, any>): string => {
    const updates: string[] = [];

    if (intent.supplier) {
      // Search and set supplier
      supabase.from("suppliers").select("id, name, contact_email, contact_name")
        .ilike("name", `%${intent.supplier}%`).limit(1)
        .then(({ data }) => {
          if (data && data[0]) {
            setSupplier({ ...data[0], label: data[0].name });
            updates.push(`Set supplier to ${data[0].name}`);
          }
        });
      updates.push(`Looking up supplier "${intent.supplier}"`);
    }

    if (intent.department) {
      supabase.from("departments").select("id, name")
        .ilike("name", `%${intent.department}%`).limit(1)
        .then(({ data }) => {
          if (data && data[0]) {
            setDepartment({ ...data[0], label: data[0].name });
          }
        });
      updates.push(`Setting department to "${intent.department}"`);
    }

    if (intent.items && Array.isArray(intent.items)) {
      for (const intentItem of intent.items) {
        supabase.from("inventory_items").select("id, name, item_type, default_unit_cost, sku")
          .ilike("name", `%${intentItem.name}%`).limit(1)
          .then(({ data }) => {
            if (data && data[0]) {
              const match = data[0];
              setItems((prev) => {
                // Check if item already exists
                const existing = prev.find((li) => li.item?.id === match.id);
                if (existing) {
                  return prev.map((li) =>
                    li.item?.id === match.id
                      ? { ...li, quantity: String(intentItem.quantity || li.quantity) }
                      : li
                  );
                }
                // Add new line or fill empty slot
                const empty = prev.find((li) => !li.item);
                const newLi = {
                  id: empty?.id || String(Date.now()),
                  item: { ...match, label: match.sku ? `${match.name} (${match.sku})` : match.name },
                  quantity: String(intentItem.quantity || 1),
                  unit_cost: match.default_unit_cost ? String(match.default_unit_cost) : "",
                  item_type: (match.item_type || "resale") as any,
                  unit: null,
                };
                if (empty) return prev.map((li) => (li.id === empty.id ? newLi : li));
                return [...prev, newLi];
              });
            }
          });
        updates.push(`Adding ${intentItem.quantity || 1}× ${intentItem.name}`);
      }
    }

    return updates.length > 0
      ? `I've updated the form: ${updates.join(". ")}.`
      : "I couldn't find specific fields to update from that request.";
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0">
      <PageHeader
        title="New Purchase Order"
        description="Create a purchase order and submit for approval"
      />

      <div className="p-8 max-w-4xl">
        {error && (
          <div className="mb-6 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="fieldcore-card p-6 space-y-6">
          {/* Supplier */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Supplier *</Label>
            <ComboBox
              value={supplier}
              onChange={setSupplier}
              onSearch={searchSuppliers}
              onCreateNew={(name) => {
                setNewSupplierName(name);
                setSupplierModalError("");
                setShowSupplierModal(true);
              }}
              allowCreate
              createLabel="Create new supplier"
              placeholder="Search suppliers..."
            />
            {supplier?.contact_name && (
              <p className="text-xs text-muted-foreground">
                Contact: {supplier.contact_name}
                {supplier.contact_email && ` · ${supplier.contact_email}`}
              </p>
            )}
          </div>

          {/* Department */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Department</Label>
            <ComboBox
              value={department}
              onChange={setDepartment}
              onSearch={searchDepartments}
              placeholder="Search departments (optional)..."
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes for this order..."
              className="resize-none"
              rows={3}
            />
          </div>

          {/* Line Items */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Line Items</Label>

            {/* Desktop header */}
            <div className="hidden md:grid md:grid-cols-[1fr_100px_100px_120px_100px_40px] gap-3 text-xs font-medium text-muted-foreground px-1">
              <span>Item</span>
              <span>Qty</span>
              <span>Unit Cost</span>
              <span>Type</span>
              <span>Total</span>
              <span></span>
            </div>

            {items.map((item, index) => (
              <div
                key={item.id}
                className="rounded-md border bg-card p-4 md:p-0 md:border-0 md:bg-transparent space-y-3 md:space-y-0 md:grid md:grid-cols-[1fr_100px_100px_120px_100px_40px] md:gap-3 md:items-start"
              >
                {/* Mobile header */}
                <div className="flex items-center justify-between md:hidden">
                  <span className="text-xs font-medium text-muted-foreground">
                    Item {index + 1}
                  </span>
                  <button
                    type="button"
                    className="text-xs text-destructive hover:underline"
                    onClick={() => removeLineItem(item.id)}
                    disabled={items.length === 1}
                  >
                    Remove
                  </button>
                </div>

                {/* Item ComboBox */}
                <ComboBox
                  value={item.item}
                  onChange={(selected) => {
                    updateLineItem(item.id, {
                      item: selected,
                      item_type: (selected?.item_type as InventoryType) || "resale",
                      unit_cost: selected?.default_unit_cost
                        ? String(selected.default_unit_cost)
                        : item.unit_cost,
                    });
                  }}
                  onSearch={searchItems}
                  onCreateNew={(name) => {
                    setNewItemName(name);
                    setItemModalLineId(item.id);
                    setShowItemModal(true);
                  }}
                  allowCreate
                  createLabel="Create new item"
                  placeholder="Search items..."
                />

                {/* Quantity */}
                <div className="md:contents">
                  <div className="flex items-center gap-2 md:block">
                    <Label className="text-xs text-muted-foreground md:hidden w-16">Qty</Label>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) =>
                        updateLineItem(item.id, { quantity: e.target.value })
                      }
                      placeholder="Qty"
                      step="1"
                      min="1"
                    />
                  </div>
                </div>

                {/* Unit Cost */}
                <div className="md:contents">
                  <div className="flex items-center gap-2 md:block">
                    <Label className="text-xs text-muted-foreground md:hidden w-16">Cost</Label>
                    <Input
                      type="number"
                      value={item.unit_cost}
                      onChange={(e) =>
                        updateLineItem(item.id, { unit_cost: e.target.value })
                      }
                      placeholder="$0.00"
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>

                {/* Type select */}
                <div className="md:contents">
                  <div className="flex items-center gap-2 md:block">
                    <Label className="text-xs text-muted-foreground md:hidden w-16">Type</Label>
                    <Select
                      value={item.item_type}
                      onValueChange={(val: InventoryType) =>
                        updateLineItem(item.id, { item_type: val })
                      }
                    >
                      <SelectTrigger className="h-10 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="resale">Resale</SelectItem>
                        <SelectItem value="manufacturing_input">Mfg Input</SelectItem>
                        <SelectItem value="internal_use">Internal</SelectItem>
                        <SelectItem value="consumable">Consumable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Total */}
                <span className="hidden md:flex items-center h-10 text-sm font-medium text-foreground">
                  {item.quantity && item.unit_cost
                    ? `$${(parseFloat(item.quantity) * parseFloat(item.unit_cost)).toFixed(2)}`
                    : "—"}
                </span>

                {/* Remove desktop */}
                <button
                  type="button"
                  className="hidden md:flex items-center justify-center h-10 text-muted-foreground hover:text-destructive transition-colors"
                  onClick={() => removeLineItem(item.id)}
                  disabled={items.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </button>

                {/* Unit number for internal_use */}
                {item.item_type === "internal_use" && (
                  <div className="md:col-span-6 md:pl-0">
                    <Label className="text-xs text-muted-foreground mb-1 block">
                      Unit Number *
                    </Label>
                    <div className="max-w-xs">
                      <ComboBox
                        value={item.unit}
                        onChange={(u) => updateLineItem(item.id, { unit: u })}
                        onSearch={searchUnits}
                        onCreateNew={(number) => {
                          setNewUnitNumber(number);
                          setUnitModalLineId(item.id);
                          setShowUnitModal(true);
                        }}
                        allowCreate
                        createLabel="Create new unit"
                        placeholder="Search units (T-101, SHOP, V-2045)..."
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addLineItem}
            >
              <Plus className="h-4 w-4" />
              Add Line Item
            </Button>
          </div>

          {/* Total */}
          {total > 0 && (
            <div className="text-right rounded-md bg-muted/50 p-4">
              <span className="text-lg font-semibold text-foreground">
                Total: ${total.toFixed(2)}
              </span>
              {approvalPreview && (
                <p className={`text-xs mt-1 ${
                  requiresApproval
                    ? "text-amber-600"
                    : "text-muted-foreground"
                }`}>
                  {requiresApproval
                    ? `This order requires ${approvalPreview.required_role} approval`
                    : "This order does not require approval"}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => navigate("/purchase-orders")}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting || !!getValidationError()}
            >
              Save as Draft
            </Button>
            <Button
              onClick={() => handleSubmit(true)}
              disabled={isSubmitting || !!getValidationError()}
            >
              {isSubmitting
                ? "Saving..."
                : requiresApproval
                ? "Submit for Approval"
                : "Create Purchase Order"}
            </Button>
          </div>
        </div>
      </div>

      {/* Create Supplier Modal */}
      <Dialog open={showSupplierModal} onOpenChange={setShowSupplierModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Supplier</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {supplierModalError && (
              <p className="text-sm text-destructive">{supplierModalError}</p>
            )}
            <div className="space-y-2">
              <Label>Supplier Name *</Label>
              <Input
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Contact Email</Label>
              <Input
                value={newSupplierEmail}
                onChange={(e) => setNewSupplierEmail(e.target.value)}
                type="email"
                placeholder="supplier@example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSupplierModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSupplier}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Item Modal */}
      <Dialog open={showItemModal} onOpenChange={setShowItemModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Item Name *</Label>
              <Input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>SKU</Label>
              <Input
                value={newItemSku}
                onChange={(e) => setNewItemSku(e.target.value)}
                placeholder="Optional SKU"
              />
            </div>
            <div className="space-y-2">
              <Label>Item Type</Label>
              <Select
                value={newItemType}
                onValueChange={(val: InventoryType) => setNewItemType(val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="resale">Resale</SelectItem>
                  <SelectItem value="manufacturing_input">Manufacturing Input</SelectItem>
                  <SelectItem value="internal_use">Internal Use</SelectItem>
                  <SelectItem value="consumable">Consumable</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowItemModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateItem}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Unit Modal */}
      <Dialog open={showUnitModal} onOpenChange={setShowUnitModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Unit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Unit Number *</Label>
              <Input
                value={newUnitNumber}
                onChange={(e) => setNewUnitNumber(e.target.value)}
                placeholder="e.g., T-101, SHOP, V-2045"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUnitModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateUnit}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>

      {/* Assistant Panel */}
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
