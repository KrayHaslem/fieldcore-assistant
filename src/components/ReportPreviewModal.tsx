import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { BarChart3 } from "lucide-react";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
];

function getNumericColumns(columns: string[], rows: Record<string, any>[]) {
  if (rows.length === 0) return [];
  return columns.filter((col) => {
    const val = rows[0][col];
    return typeof val === "number" || (typeof val === "string" && !isNaN(Number(val)) && val.trim() !== "");
  });
}

interface ReportPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateName: string;
  templateDescription?: string;
  chartType: string;
  data: { columns: string[]; rows: Record<string, any>[] };
}

export function ReportPreviewModal({
  open,
  onOpenChange,
  templateName,
  templateDescription,
  chartType,
  data,
}: ReportPreviewModalProps) {
  const [searchFilter, setSearchFilter] = useState("");

  const numCols = getNumericColumns(data.columns, data.rows);
  const labelCol = data.columns.find((c) => !numCols.includes(c)) || data.columns[0];
  const showChart = (chartType === "bar" || chartType === "line") && data.rows.length > 0 && numCols.length > 0;

  const filteredRows = data.rows.filter((row) => {
    if (!searchFilter) return true;
    const term = searchFilter.toLowerCase();
    return data.columns.some((col) => {
      const val = row[col];
      return val != null && String(val).toLowerCase().includes(term);
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Report Preview — {templateName || "Untitled"}
          </DialogTitle>
          {templateDescription && (
            <DialogDescription>{templateDescription}</DialogDescription>
          )}
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          This is how the report will appear on the Reports tab.
        </p>

        <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
          {data.rows.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <BarChart3 className="mx-auto h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">Query returned no rows.</p>
            </div>
          ) : (
            <>
              {/* Chart */}
              {showChart && (
                <div className="border rounded-lg p-4 bg-card">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      {chartType === "bar" ? (
                        <BarChart data={data.rows.map((r) => {
                          const row: any = { ...r };
                          numCols.forEach((c) => { row[c] = Number(row[c]); });
                          return row;
                        })}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey={labelCol} tick={{ fontSize: 11 }} className="text-muted-foreground" />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Legend />
                          {numCols.map((col, idx) => (
                            <Bar key={col} dataKey={col} fill={CHART_COLORS[idx % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
                          ))}
                        </BarChart>
                      ) : (
                        <LineChart data={data.rows.map((r) => {
                          const row: any = { ...r };
                          numCols.forEach((c) => { row[c] = Number(row[c]); });
                          return row;
                        })}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey={labelCol} tick={{ fontSize: 11 }} className="text-muted-foreground" />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Legend />
                          {numCols.map((col, idx) => (
                            <Line key={col} type="monotone" dataKey={col} stroke={CHART_COLORS[idx % CHART_COLORS.length]} strokeWidth={2} dot={false} />
                          ))}
                        </LineChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Filter */}
              <Input
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter results..."
                className="max-w-xs text-sm h-9"
              />

              {/* Table */}
              <div className="border rounded-lg overflow-hidden bg-card">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        {data.columns.map((col) => (
                          <th key={col} className="px-4 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">
                            {col.replace(/_/g, " ")}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredRows.map((row, i) => (
                        <tr key={i}>
                          {data.columns.map((col) => {
                            const val = row[col];
                            const isNum = typeof val === "number" || (typeof val === "string" && !isNaN(Number(val)) && val.trim() !== "");
                            return (
                              <td key={col} className={cn("px-4 py-2 text-foreground whitespace-nowrap", isNum && "text-right")}>
                                {isNum ? Number(val).toLocaleString() : String(val ?? "—")}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {data.rows.length > filteredRows.length && (
                  <div className="px-4 py-2 text-xs text-muted-foreground bg-muted/30 border-t">
                    Showing {filteredRows.length} of {data.rows.length} rows (filtered)
                  </div>
                )}
                {!searchFilter && data.rows.length > 0 && (
                  <div className="px-4 py-2 text-xs text-muted-foreground bg-muted/30 border-t">
                    {data.rows.length} row{data.rows.length !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
