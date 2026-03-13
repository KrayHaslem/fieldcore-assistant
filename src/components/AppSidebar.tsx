import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, ShoppingCart, Package, DollarSign, BarChart3, Settings, Wrench, ClipboardCheck, LogOut, FolderOpen, ChevronsUpDown } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { AppLogo } from "@/components/AppLogo";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/orders", icon: ShoppingCart, label: "Orders" },
  { to: "/po-groups", icon: FolderOpen, label: "PO Groups", roles: ["admin", "procurement"] as string[] },
  { to: "/inventory", icon: Package, label: "Inventory" },
  { to: "/sales", icon: DollarSign, label: "Sales" },
  { to: "/assemblies", icon: Wrench, label: "Assemblies" },
  { to: "/reconciliation", icon: ClipboardCheck, label: "Reconciliation" },
  { to: "/reports", icon: BarChart3, label: "Reports" },
  { to: "/settings", icon: Settings, label: "Settings" },
] as const;

export function AppSidebar() {
  const { profile, roles, signOut, orgName, organizations, switchOrg } = useAuth();
  const location = useLocation();
  const hasMultipleOrgs = organizations.length > 1;

  return (
    <aside className="flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <AppLogo size="md" />
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-bold text-sidebar-accent-foreground tracking-tight">FieldCore</h1>
          <p className="text-[10px] text-sidebar-muted uppercase tracking-widest">Resource Systems</p>
        </div>
      </div>

      {/* Org Switcher */}
      <div className="px-3 py-2 border-b border-sidebar-border">
        {hasMultipleOrgs ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-xs font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors">
                <span className="truncate">{orgName ?? "Organization"}</span>
                <ChevronsUpDown className="h-3 w-3 flex-shrink-0 text-sidebar-muted" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {organizations.map((org) => (
                <DropdownMenuItem
                  key={org.id}
                  onClick={() => switchOrg(org.id)}
                  className={cn(
                    "text-sm",
                    org.id === profile?.organization_id && "font-semibold"
                  )}
                >
                  {org.name}
                  {org.id === profile?.organization_id && (
                    <span className="ml-auto text-xs text-muted-foreground">Current</span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="px-3 py-2">
            <p className="text-xs font-medium text-sidebar-foreground truncate">{orgName ?? "Organization"}</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {navItems.map((item) => {
          if ("roles" in item && item.roles && !item.roles.some((r) => roles.includes(r))) return null;
          const isActive = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-sidebar-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-sidebar-accent-foreground">
              {profile?.full_name ?? "User"}
            </p>
            <p className="truncate text-xs text-sidebar-muted">
              {roles[0] ?? "employee"}
            </p>
          </div>
          <button
            onClick={signOut}
            className="rounded-md p-1.5 text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
