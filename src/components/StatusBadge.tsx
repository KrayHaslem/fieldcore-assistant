import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  draft: "status-draft",
  submitted: "status-submitted",
  approved: "status-approved",
  ordered: "status-ordered",
  partially_received: "status-partial",
  received: "status-received",
  closed: "status-closed",
  quote: "status-submitted",
  order: "status-approved",
  fulfilled: "status-received",
  invoiced: "status-ordered",
  paid: "status-approved",
};

export function StatusBadge({ status }: { status: string }) {
  const displayStatus = status === "partially_received" ? "Partially Received" : status;
  return (
    <span className={cn("status-badge capitalize", statusStyles[status] ?? "status-draft")}>
      {displayStatus}
    </span>
  );
}
