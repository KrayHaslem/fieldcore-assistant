import React from "react";

type ContactInfo = {
  name?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
};

type LineItem = {
  id: string;
  itemName: string;
  sku?: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
  unitNumber?: string | null;
};

type PrintableOrderProps = {
  type: "purchase" | "sales";
  orderNumber: string;
  date: string;
  status: string;
  orgName: string;
  contact: ContactInfo;
  lineItems: LineItem[];
  totalAmount: number;
  notes?: string | null;
  department?: string | null;
  createdBy?: string | null;
};

export function PrintableOrder({
  type,
  orderNumber,
  date,
  status,
  orgName,
  contact,
  lineItems,
  totalAmount,
  notes,
  department,
  createdBy,
}: PrintableOrderProps) {
  const contactLabel = type === "purchase" ? "Vendor" : "Customer";

  return (
    <div className="printable-order hidden print:block">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, borderBottom: "2px solid #000", paddingBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{orgName}</h1>
          <p style={{ fontSize: 11, color: "#666", margin: "4px 0 0" }}>
            {type === "purchase" ? "Purchase Order" : "Sales Order"}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{orderNumber}</p>
          <p style={{ fontSize: 11, color: "#666", margin: "2px 0" }}>Date: {new Date(date).toLocaleDateString()}</p>
          <p style={{ fontSize: 11, color: "#666", margin: 0 }}>Status: {status.replace(/_/g, " ").toUpperCase()}</p>
        </div>
      </div>

      {/* Contact + Order Info */}
      <div style={{ display: "flex", gap: 40, marginBottom: 24 }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "#666", marginBottom: 6, letterSpacing: 0.5 }}>{contactLabel}</h3>
          <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{contact.name || "—"}</p>
          {contact.contactName && <p style={{ fontSize: 12, margin: "2px 0" }}>Attn: {contact.contactName}</p>}
          {contact.contactEmail && <p style={{ fontSize: 12, margin: "2px 0" }}>{contact.contactEmail}</p>}
          {contact.contactPhone && <p style={{ fontSize: 12, margin: "2px 0" }}>{contact.contactPhone}</p>}
          {contact.address && <p style={{ fontSize: 12, margin: "2px 0", whiteSpace: "pre-line" }}>{contact.address}</p>}
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "#666", marginBottom: 6, letterSpacing: 0.5 }}>Order Info</h3>
          {department && <p style={{ fontSize: 12, margin: "2px 0" }}>Department: {department}</p>}
          {createdBy && <p style={{ fontSize: 12, margin: "2px 0" }}>Created by: {createdBy}</p>}
        </div>
      </div>

      {/* Line Items Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 24 }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #000" }}>
            <th style={{ textAlign: "left", padding: "8px 6px", fontWeight: 600 }}>Item</th>
            <th style={{ textAlign: "left", padding: "8px 6px", fontWeight: 600 }}>SKU</th>
            <th style={{ textAlign: "right", padding: "8px 6px", fontWeight: 600 }}>Qty</th>
            <th style={{ textAlign: "right", padding: "8px 6px", fontWeight: 600 }}>Unit Price</th>
            <th style={{ textAlign: "right", padding: "8px 6px", fontWeight: 600 }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((li) => (
            <tr key={li.id} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "6px" }}>
                {li.itemName}
                {li.unitNumber && <span style={{ fontSize: 10, color: "#888", display: "block" }}>Unit: {li.unitNumber}</span>}
              </td>
              <td style={{ padding: "6px", color: "#666" }}>{li.sku || "—"}</td>
              <td style={{ padding: "6px", textAlign: "right" }}>{li.quantity}</td>
              <td style={{ padding: "6px", textAlign: "right" }}>${li.unitPrice.toFixed(2)}</td>
              <td style={{ padding: "6px", textAlign: "right", fontWeight: 600 }}>${li.total.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: "2px solid #000" }}>
            <td colSpan={4} style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700, fontSize: 13 }}>Grand Total:</td>
            <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700, fontSize: 13 }}>${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          </tr>
        </tfoot>
      </table>

      {/* Notes */}
      {notes && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "#666", marginBottom: 4, letterSpacing: 0.5 }}>Notes</h3>
          <p style={{ fontSize: 12, margin: 0, whiteSpace: "pre-line" }}>{notes}</p>
        </div>
      )}

      {/* Footer */}
      <div style={{ borderTop: "1px solid #ccc", paddingTop: 12, fontSize: 10, color: "#999", textAlign: "center" }}>
        Printed {new Date().toLocaleString()} · {orgName}
      </div>
    </div>
  );
}
