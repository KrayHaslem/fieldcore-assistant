import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ShoppingCart,
  PackageCheck,
  FileText,
  CreditCard,
  Lock,
} from "lucide-react";

type SOStatus = "quote" | "order" | "fulfilled" | "invoiced" | "paid" | "closed";

const statusFlow: Record<string, { next: SOStatus; label: string; icon: typeof ShoppingCart }[]> = {
  quote: [{ next: "order", label: "Convert to Order", icon: ShoppingCart }],
  order: [{ next: "fulfilled", label: "Mark Fulfilled", icon: PackageCheck }],
  fulfilled: [{ next: "invoiced", label: "Mark Invoiced", icon: FileText }],
  invoiced: [{ next: "paid", label: "Record Payment", icon: CreditCard }],
  paid: [{ next: "closed", label: "Close Order", icon: Lock }],
  closed: [],
};

export default function SalesOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, orgId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUpdating, setIsUpdating] = useState(false);

  const { data: so, isLoading } = useQuery({
    queryKey: ["sales-order", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_orders")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: lineItems } = useQuery({
    queryKey: ["so-items", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("sales_order_items")
        .select("*, inventory_items:item_id(name, sku)")
        .eq("sales_order_id", id!);
      return data ?? [];
    },
  });

  const handleStatusChange = async (newStatus: SOStatus) => {
    setIsUpdating(true);
    try {
      // Fulfill → create inventory movements
      if (newStatus === "fulfilled") {
        for (const li of lineItems ?? []) {
          const { error } = await supabase.from("inventory_movements").insert({
            organization_id: orgId!,
            item_id: li.item_id,
            movement_type: "sale" as const,
            quantity: -li.quantity,
            source_type: "sales_order" as const,
            source_id: so!.id,
            created_by: user!.id,
          });
          if (error) throw error;
        }
      }

      const { error } = await supabase
        .from("sales_orders")
        .update({ status: newStatus })
        .eq("id", id!);
      if (error) throw error;

      const msg = newStatus === "fulfilled"
        ? `Order fulfilled. ${lineItems?.length ?? 0} inventory movement(s) created.`
        : `Status updated to ${newStatus}.`;
      toast({ title: "Updated", description: msg });
      queryClient.invalidateQueries({ queryKey: ["sales-order", id] });
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
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

  if (!so) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Sales order not found.
        <Button variant="link" onClick={() => navigate("/sales")}>Back to list</Button>
      </div>
    );
  }

  const actions = statusFlow[so.status] || [];

  return (
    <div>
      <PageHeader
        title={so.so_number}
        description="Sales order details"
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate("/sales")}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        }
      />

      <div className="p-8 max-w-4xl space-y-6">
        {/* Status & Actions */}
        <div className="fieldcore-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">Status:</span>
              <StatusBadge status={so.status} />
            </div>
            <div className="flex gap-2">
              {actions.map((a) => (
                <Button key={a.next} size="sm" onClick={() => handleStatusChange(a.next)} disabled={isUpdating}>
                  <a.icon className="h-4 w-4" /> {a.label}
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
              <span className="text-muted-foreground">Customer</span>
              <p className="font-medium text-foreground">{so.customer_name}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Total Amount</span>
              <p className="font-medium text-foreground">${Number(so.total_amount).toLocaleString()}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Created</span>
              <p className="font-medium text-foreground">{new Date(so.created_at).toLocaleDateString()}</p>
            </div>
            {so.notes && (
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">Notes</span>
                <p className="font-medium text-foreground">{so.notes}</p>
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
                <th className="px-5 py-3 font-medium text-muted-foreground text-right">Qty</th>
                <th className="px-5 py-3 font-medium text-muted-foreground text-right">Unit Price</th>
                <th className="px-5 py-3 font-medium text-muted-foreground text-right">Total</th>
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
                  </td>
                  <td className="px-5 py-3 text-right text-foreground">{li.quantity}</td>
                  <td className="px-5 py-3 text-right text-foreground">${Number(li.unit_price).toFixed(2)}</td>
                  <td className="px-5 py-3 text-right font-medium text-foreground">
                    ${(li.quantity * Number(li.unit_price)).toFixed(2)}
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
