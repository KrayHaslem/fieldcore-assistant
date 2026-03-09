import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Send,
  CheckCircle,
  XCircle,
  Truck,
  PackageCheck,
  Lock,
} from "lucide-react";

type POStatus = "draft" | "submitted" | "approved" | "ordered" | "partially_received" | "received" | "closed";

const statusFlow: Record<string, { next: POStatus; label: string; icon: typeof Send }[]> = {
  draft: [{ next: "submitted", label: "Submit for Approval", icon: Send }],
  submitted: [
    { next: "approved", label: "Approve", icon: CheckCircle },
    { next: "draft", label: "Reject (Return to Draft)", icon: XCircle },
  ],
  approved: [{ next: "ordered", label: "Mark as Ordered", icon: Truck }],
  ordered: [{ next: "received", label: "Mark as Received", icon: PackageCheck }],
  partially_received: [{ next: "received", label: "Receive More Items", icon: PackageCheck }],
  received: [{ next: "closed", label: "Close PO", icon: Lock }],
  closed: [],
};

export default function PurchaseOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, roles, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUpdating, setIsUpdating] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receivingItems, setReceivingItems] = useState<Record<string, string>>({});

  const { data: po, isLoading } = useQuery({
    queryKey: ["purchase-order", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("*, suppliers(name, contact_name, contact_email), departments(name)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: lineItems } = useQuery({
    queryKey: ["po-items", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("purchase_order_items")
        .select("*, inventory_items:item_id(name, sku), units:unit_id(unit_number)")
        .eq("purchase_order_id", id!);
      return data ?? [];
    },
  });

  const { data: createdByProfile } = useQuery({
    queryKey: ["profile-by-user", po?.created_by],
    enabled: !!po?.created_by,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", po!.created_by)
        .single();
      return data;
    },
  });

  const { data: assignedApproverName } = useQuery({
    queryKey: ["approver-profile", po?.assigned_approver_id],
    enabled: !!po?.assigned_approver_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", po!.assigned_approver_id!)
        .single();
      return data?.full_name ?? null;
    },
  });

  const canApprove = useMemo(() => {
    if (!po || !user) return false;
    if (roles.includes("admin")) return true;
    if ((po as any).assigned_approver_id) {
      return (po as any).assigned_approver_id === user.id;
    }
    const hasRequiredRole = (po as any).required_approver_role
      ? roles.includes((po as any).required_approver_role)
      : false;
    if (!hasRequiredRole) return false;
    if ((po as any).rule_is_department_scoped && po.department_id) {
      return profile?.department_id === po.department_id;
    }
    return true;
  }, [po, user, roles, profile]);

  const isCreator = user?.id === po?.created_by;

  const handleStatusChange = async (newStatus: POStatus) => {
    if (newStatus === "received") {
      // Open receiving modal instead - pre-populate with remaining quantities
      const initial: Record<string, string> = {};
      lineItems?.forEach((li: any) => {
        const alreadyReceived = li.quantity_received ?? 0;
        const remaining = Math.max(0, li.quantity - alreadyReceived);
        initial[li.id] = String(remaining);
      });
      setReceivingItems(initial);
      setShowReceiveModal(true);
      return;
    }

    setIsUpdating(true);
    try {
      const updates: any = { status: newStatus };
      if (newStatus === "approved") {
        updates.approved_by = user!.id;
        updates.approved_at = new Date().toISOString();
      }
      if (newStatus === "ordered") {
        updates.ordered_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("purchase_orders")
        .update(updates)
        .eq("id", id!);
      if (error) throw error;

      toast({ title: "Status Updated", description: `PO moved to ${newStatus}` });
      queryClient.invalidateQueries({ queryKey: ["purchase-order", id] });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReceive = async () => {
    setIsUpdating(true);
    try {
      const orgId = po!.organization_id;
      let itemsReceived = 0;
      let movementsCreated = 0;
      const shortfalls: { name: string; ordered: number; received: number }[] = [];

      for (const li of lineItems ?? []) {
        const qtyThisShipment = parseInt(receivingItems[li.id] || "0", 10);
        const previouslyReceived = li.quantity_received ?? 0;
        const newTotalReceived = previouslyReceived + qtyThisShipment;

        // Build update payload
        const itemUpdate: any = { quantity_received: newTotalReceived };
        
        // Check for shortfall
        if (newTotalReceived < li.quantity) {
          const shortfall = li.quantity - newTotalReceived;
          itemUpdate.shortfall_notes = `Ordered ${li.quantity}, received ${newTotalReceived}. Shortfall: ${shortfall}.`;
          shortfalls.push({
            name: li.inventory_items?.name ?? "Unknown Item",
            ordered: li.quantity,
            received: newTotalReceived,
          });
        } else {
          itemUpdate.shortfall_notes = null;
        }

        await supabase
          .from("purchase_order_items")
          .update(itemUpdate)
          .eq("id", li.id);

        if (qtyThisShipment > 0) {
          itemsReceived++;
          if (li.item_type !== "internal_use") {
            const { error } = await supabase.from("inventory_movements").insert({
              item_id: li.item_id,
              movement_type: "received" as const,
              quantity: qtyThisShipment,
              source_type: "purchase_order" as const,
              source_id: po!.id,
              created_by: user!.id,
              organization_id: orgId,
              notes: `Received from PO ${po!.po_number}`,
            });
            if (error) throw error;
            movementsCreated++;
          }
        }
      }

      // Determine if fully received or partially received
      const hasShortfall = shortfalls.length > 0;
      const newStatus: POStatus = hasShortfall ? "partially_received" : "received";
      
      const poUpdate: any = { 
        status: newStatus, 
        has_shortfall: hasShortfall,
      };
      if (newStatus === "received") {
        poUpdate.received_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("purchase_orders")
        .update(poUpdate)
        .eq("id", id!);
      if (error) throw error;

      // Show shortfall warning if applicable
      if (hasShortfall) {
        const shortfallList = shortfalls
          .map((s) => `${s.name} (ordered ${s.ordered}, received ${s.received})`)
          .join(", ");
        toast({
          title: `Shortfall on ${shortfalls.length} item(s)`,
          description: shortfallList,
          variant: "destructive",
        });
      }

      toast({
        title: newStatus === "received" ? "Items Fully Received" : "Items Partially Received",
        description: `${itemsReceived} item(s) received this shipment, ${movementsCreated} inventory movement(s) created.`,
      });
      setShowReceiveModal(false);
      queryClient.invalidateQueries({ queryKey: ["purchase-order", id] });
      queryClient.invalidateQueries({ queryKey: ["po-items", id] });
      queryClient.invalidateQueries({ queryKey: ["inventory-quantities"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!po) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Purchase order not found.
        <Button variant="link" onClick={() => navigate("/purchase-orders")}>Back to list</Button>
      </div>
    );
  }

  const actions = statusFlow[po.status] || [];
  const filteredActions = actions.filter((a) => {
    if (a.next === "approved" || a.next === "draft") return canApprove;
    if (a.next === "submitted") return isCreator || canApprove;
    return isCreator || canApprove;
  });

  return (
    <div>
      <PageHeader
        title={po.po_number}
        description={`Purchase order details`}
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate("/purchase-orders")}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        }
      />

      <div className="p-8 max-w-4xl space-y-6">
        {/* Status & Actions */}
        <div className="fieldcore-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">Status:</span>
              <StatusBadge status={po.status} />
            </div>
            <div className="flex flex-wrap gap-2">
              {filteredActions.map((action) => (
                <Button
                  key={action.next}
                  variant={action.next === "draft" ? "outline" : "default"}
                  size="sm"
                  onClick={() => handleStatusChange(action.next)}
                  disabled={isUpdating}
                >
                  <action.icon className="h-4 w-4" />
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="fieldcore-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Order Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Supplier</span>
              <p className="font-medium text-foreground">{(po as any).suppliers?.name ?? "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Department</span>
              <p className="font-medium text-foreground">{(po as any).departments?.name ?? "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Created By</span>
              <p className="font-medium text-foreground">{createdByProfile?.full_name ?? "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Created</span>
              <p className="font-medium text-foreground">{new Date(po.created_at).toLocaleDateString()}</p>
            </div>
            {po.status === "submitted" && (
              <>
                <div>
                  <span className="text-muted-foreground">Required Approval</span>
                  <p className="font-medium text-foreground">
                    {(po as any).required_approver_role
                      ? `${(po as any).required_approver_role} — ${
                          (po as any).rule_is_department_scoped
                            ? `${(po as any).departments?.name ?? "department"} only`
                            : "any department"
                        }`
                      : "None required"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Assigned Approver</span>
                  <p className="font-medium text-foreground">
                    {(po as any).assigned_approver_id
                      ? assignedApproverName ?? "Loading..."
                      : (po as any).required_approver_role
                      ? `Any ${(po as any).required_approver_role}`
                      : "—"}
                  </p>
                </div>
              </>
            )}
            <div>
              <span className="text-muted-foreground">Total Amount</span>
              <p className="font-medium text-foreground">${Number(po.total_amount).toLocaleString()}</p>
            </div>
            {po.notes && (
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">Notes</span>
                <p className="font-medium text-foreground">{po.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Line Items */}
        <div className="fieldcore-card overflow-hidden">
          <div className="border-b px-5 py-3">
            <h3 className="text-sm font-semibold text-foreground">Line Items</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-5 py-3 font-medium text-muted-foreground">Item</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Type</th>
                <th className="px-5 py-3 font-medium text-muted-foreground text-right">Qty</th>
                <th className="px-5 py-3 font-medium text-muted-foreground text-right">Unit Cost</th>
                <th className="px-5 py-3 font-medium text-muted-foreground text-right">Total</th>
                {po.status === "received" && (
                  <th className="px-5 py-3 font-medium text-muted-foreground text-right">Received</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {lineItems?.map((li: any) => (
                <tr key={li.id}>
                  <td className="px-5 py-3">
                    <p className="font-medium text-foreground">{li.inventory_items?.name ?? "—"}</p>
                    {li.inventory_items?.sku && (
                      <p className="text-xs text-muted-foreground">{li.inventory_items.sku}</p>
                    )}
                    {li.units?.unit_number && (
                      <p className="text-xs text-accent">Unit: {li.units.unit_number}</p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground capitalize">
                    {li.item_type?.replace("_", " ")}
                  </td>
                  <td className="px-5 py-3 text-right text-foreground">{li.quantity}</td>
                  <td className="px-5 py-3 text-right text-foreground">${Number(li.unit_cost).toFixed(2)}</td>
                  <td className="px-5 py-3 text-right font-medium text-foreground">
                    ${(li.quantity * Number(li.unit_cost)).toFixed(2)}
                  </td>
                  {po.status === "received" && (
                    <td className="px-5 py-3 text-right">
                      <span className={li.quantity_received < li.quantity ? "text-destructive font-medium" : "text-foreground"}>
                        {li.quantity_received ?? 0}
                      </span>
                      {li.quantity_received < li.quantity && (
                        <span className="text-xs text-destructive ml-1">(short {li.quantity - (li.quantity_received ?? 0)})</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Approval/Timeline info */}
        {po.approved_at && (
          <div className="fieldcore-card p-6">
            <h3 className="text-sm font-semibold text-foreground mb-3">Timeline</h3>
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                Created: {new Date(po.created_at).toLocaleString()}
              </p>
              {po.approved_at && (
                <p className="text-muted-foreground">
                  Approved: {new Date(po.approved_at).toLocaleString()}
                </p>
              )}
              {po.ordered_at && (
                <p className="text-muted-foreground">
                  Ordered: {new Date(po.ordered_at).toLocaleString()}
                </p>
              )}
              {po.received_at && (
                <p className="text-muted-foreground">
                  Received: {new Date(po.received_at).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Receiving Modal */}
      <Dialog open={showReceiveModal} onOpenChange={setShowReceiveModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Receive Items — {po.po_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {lineItems?.map((li: any) => (
              <div key={li.id} className="flex items-center justify-between gap-4 rounded-md border p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {li.inventory_items?.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ordered: {li.quantity} · Type: {li.item_type?.replace("_", " ")}
                  </p>
                </div>
                <div className="w-24">
                  <Label className="text-xs text-muted-foreground">Received</Label>
                  <Input
                    type="number"
                    min="0"
                    max={li.quantity}
                    value={receivingItems[li.id] || "0"}
                    onChange={(e) =>
                      setReceivingItems((prev) => ({ ...prev, [li.id]: e.target.value }))
                    }
                  />
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReceiveModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleReceive} disabled={isUpdating}>
              {isUpdating ? "Saving..." : "Confirm Receipt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
