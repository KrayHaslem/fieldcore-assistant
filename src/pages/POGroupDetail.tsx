import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Minus, Save } from "lucide-react";

const GROUPABLE_STATUSES = ["approved", "ordered", "partially_received", "received", "closed"];

export default function POGroupDetail() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new" || !id;
  const navigate = useNavigate();
  const { orgId, user, roles } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [poNumber, setPoNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  // Fetch existing group
  const { data: group, isLoading } = useQuery({
    queryKey: ["po-group", id],
    enabled: !isNew,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("po_groups")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      setPoNumber(data.po_number);
      setNotes(data.notes ?? "");
      return data;
    },
  });

  // Orders in this group
  const { data: groupedOrders } = useQuery({
    queryKey: ["po-group-orders", id],
    enabled: !isNew && !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("purchase_orders")
        .select("id, po_number, status, total_amount, suppliers(name)")
        .eq("po_group_id", id!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Approved orders not in any group
  const { data: availableOrders } = useQuery({
    queryKey: ["available-orders-for-group", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("purchase_orders")
        .select("id, po_number, status, total_amount, suppliers(name)")
        .is("po_group_id", null)
        .in("status", GROUPABLE_STATUSES)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const combinedTotal = (groupedOrders ?? []).reduce(
    (sum, o: any) => sum + Number(o.total_amount ?? 0),
    0
  );

  const handleCreate = async () => {
    if (!poNumber.trim()) {
      toast({ title: "PO number is required", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from("po_groups")
        .insert({
          organization_id: orgId!,
          po_number: poNumber.trim(),
          notes: notes.trim() || null,
          created_by: user!.id,
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      toast({ title: "PO Group created" });
      navigate(`/po-groups/${data.id}`, { replace: true });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!poNumber.trim()) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("po_groups")
        .update({ po_number: poNumber.trim(), notes: notes.trim() || null } as any)
        .eq("id", id!);
      if (error) throw error;
      toast({ title: "PO Group updated" });
      queryClient.invalidateQueries({ queryKey: ["po-group", id] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddOrders = async () => {
    if (selectedOrderIds.length === 0) return;
    setIsSaving(true);
    try {
      for (const orderId of selectedOrderIds) {
        const { error } = await supabase
          .from("purchase_orders")
          .update({ po_group_id: id } as any)
          .eq("id", orderId);
        if (error) throw error;
      }
      toast({ title: `${selectedOrderIds.length} order(s) added` });
      setSelectedOrderIds([]);
      queryClient.invalidateQueries({ queryKey: ["po-group-orders", id] });
      queryClient.invalidateQueries({ queryKey: ["available-orders-for-group"] });
      queryClient.invalidateQueries({ queryKey: ["po-groups"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveOrder = async (orderId: string) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("purchase_orders")
        .update({ po_group_id: null } as any)
        .eq("id", orderId);
      if (error) throw error;
      toast({ title: "Order removed from group" });
      queryClient.invalidateQueries({ queryKey: ["po-group-orders", id] });
      queryClient.invalidateQueries({ queryKey: ["available-orders-for-group"] });
      queryClient.invalidateQueries({ queryKey: ["po-groups"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((i) => i !== orderId) : [...prev, orderId]
    );
  };

  if (!isNew && isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Create form
  if (isNew) {
    return (
      <div>
        <PageHeader
          title="Create PO Group"
          description="Assign an official PO number to group approved orders"
          actions={
            <Button variant="outline" size="sm" onClick={() => navigate("/po-groups")}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          }
        />
        <div className="p-8 max-w-lg space-y-4">
          <div className="fieldcore-card p-6 space-y-4">
            <div>
              <Label>Official PO Number</Label>
              <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="e.g. PO-2024-001" />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>
            <Button onClick={handleCreate} disabled={isSaving || !poNumber.trim()}>
              {isSaving ? "Creating..." : "Create PO Group"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`PO Group: ${group?.po_number ?? ""}`}
        description="Manage grouped orders"
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate("/po-groups")}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        }
      />

      <div className="p-8 max-w-4xl space-y-6">
        {/* Edit PO Group details */}
        <div className="fieldcore-card p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Group Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Official PO Number</Label>
              <Input
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                disabled={!roles.includes("admin")}
              />
            </div>
            <div>
              <Label>Combined Total</Label>
              <p className="mt-2 text-lg font-semibold text-foreground">${combinedTotal.toLocaleString()}</p>
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4" /> Save Changes
          </Button>
        </div>

        {/* Orders in group */}
        <div className="fieldcore-card overflow-hidden">
          <div className="border-b px-5 py-3">
            <h3 className="text-sm font-semibold text-foreground">
              Orders in this Group ({groupedOrders?.length ?? 0})
            </h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-5 py-3 font-medium text-muted-foreground">Order #</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Supplier</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-5 py-3 font-medium text-muted-foreground text-right">Total</th>
                <th className="px-5 py-3 font-medium text-muted-foreground" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {(groupedOrders ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-muted-foreground">
                    No orders assigned yet
                  </td>
                </tr>
              )}
              {(groupedOrders ?? []).map((o: any) => (
                <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                  <td
                    className="px-5 py-3 font-medium text-primary cursor-pointer hover:underline"
                    onClick={() => navigate(`/purchase-orders/${o.id}`)}
                  >
                    {o.po_number}
                  </td>
                  <td className="px-5 py-3 text-foreground">{o.suppliers?.name ?? "—"}</td>
                  <td className="px-5 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-5 py-3 text-right font-medium text-foreground">
                    ${Number(o.total_amount ?? 0).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveOrder(o.id)}
                      disabled={isSaving}
                    >
                      <Minus className="h-4 w-4" /> Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add orders */}
        <div className="fieldcore-card overflow-hidden">
          <div className="border-b px-5 py-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Add Orders</h3>
            {selectedOrderIds.length > 0 && (
              <Button size="sm" onClick={handleAddOrders} disabled={isSaving}>
                <Plus className="h-4 w-4" /> Add {selectedOrderIds.length} Order(s)
              </Button>
            )}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-5 py-3 w-10" />
                <th className="px-5 py-3 font-medium text-muted-foreground">Order #</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Supplier</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-5 py-3 font-medium text-muted-foreground text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(availableOrders ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-muted-foreground">
                    No ungrouped approved orders available
                  </td>
                </tr>
              )}
              {(availableOrders ?? []).map((o: any) => (
                <tr
                  key={o.id}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => toggleOrderSelection(o.id)}
                >
                  <td className="px-5 py-3">
                    <Checkbox
                      checked={selectedOrderIds.includes(o.id)}
                      onCheckedChange={() => toggleOrderSelection(o.id)}
                    />
                  </td>
                  <td className="px-5 py-3 font-medium text-foreground">{o.po_number}</td>
                  <td className="px-5 py-3 text-foreground">{o.suppliers?.name ?? "—"}</td>
                  <td className="px-5 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-5 py-3 text-right font-medium text-foreground">
                    ${Number(o.total_amount ?? 0).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
