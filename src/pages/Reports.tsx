import { PageHeader } from "@/components/PageHeader";
import { BarChart3, TrendingUp, Package, DollarSign, ShoppingCart, Wrench } from "lucide-react";
import { useNavigate } from "react-router-dom";

const reportCategories = [
  {
    title: "Purchasing",
    icon: ShoppingCart,
    reports: [
      { name: "Spending by Supplier", description: "Total spend grouped by supplier" },
      { name: "Monthly Purchase Totals", description: "Purchase spend by month" },
      { name: "Quarterly Spending", description: "Purchase spend by quarter" },
      { name: "Open Purchase Orders", description: "All POs not yet closed" },
      { name: "Pending Approvals", description: "POs awaiting approval by department" },
      { name: "Purchase History by Item", description: "All purchases of a specific item over time" },
    ],
  },
  {
    title: "Inventory",
    icon: Package,
    reports: [
      { name: "Inventory Valuation", description: "On-hand quantity × average cost per item" },
      { name: "Reconciliation History", description: "Expected vs actual and variance over time" },
      { name: "Inventory Performance", description: "Movement history per item" },
      { name: "Recommended Stock Levels", description: "Suggested reorder quantities" },
      { name: "Inventory Loss Summary", description: "Items with negative reconciliation variance" },
      { name: "Assembly History", description: "Finished goods produced over time" },
    ],
  },
  {
    title: "Sales",
    icon: DollarSign,
    reports: [
      { name: "Sales by Item", description: "Units sold and revenue per item" },
      { name: "Margin by Item", description: "Revenue minus COGS per item" },
      { name: "Quarterly Revenue", description: "Total revenue by quarter" },
      { name: "Sales by Salesperson", description: "Performance per sales user" },
      { name: "Margins by Timeframe", description: "Gross margin with adjustable date range" },
    ],
  },
];

export default function Reports() {
  return (
    <div>
      <PageHeader
        title="Reports"
        description="Data-driven insights from your operations"
      />

      <div className="space-y-8 p-8">
        {reportCategories.map((cat) => (
          <div key={cat.title}>
            <div className="flex items-center gap-2 mb-4">
              <cat.icon className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">{cat.title}</h2>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cat.reports.map((report) => (
                <div
                  key={report.name}
                  className="fieldcore-card p-4 cursor-pointer hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    <BarChart3 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <h3 className="text-sm font-medium text-foreground">{report.name}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">{report.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
