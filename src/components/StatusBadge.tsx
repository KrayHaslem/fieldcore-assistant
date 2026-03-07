import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  draft: "status-draft",
  submitted: "status-submitted",
  approved: "status-approved",
  ordered: "status-ordered",
  received: "status-received",
  closed: "status-closed",
  quote: "status-submitted",
  order: "status-approved",
  fulfilled: "status-received",
  invoiced: "status-ordered",
  paid: "status-approved",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("status-badge capitalize", statusStyles[status] ?? "status-draft")}>
      {status}
    </span>
  );
}
