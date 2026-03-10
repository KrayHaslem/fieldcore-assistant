import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/AppLayout";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import PurchaseOrders from "./pages/PurchaseOrders";
import CreatePurchaseOrder from "./pages/CreatePurchaseOrder";
import PurchaseOrderDetail from "./pages/PurchaseOrderDetail";
import POGroups from "./pages/POGroups";
import POGroupDetail from "./pages/POGroupDetail";
import CreateSalesOrder from "./pages/CreateSalesOrder";
import SalesOrderDetail from "./pages/SalesOrderDetail";
import Inventory from "./pages/Inventory";
import SalesOrders from "./pages/SalesOrders";
import Assemblies from "./pages/Assemblies";
import Reconciliation from "./pages/Reconciliation";
import Reports from "./pages/Reports";
import SettingsPage from "./pages/SettingsPage";
import OrgSetupWizard from "./pages/OrgSetupWizard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/orders" element={<PurchaseOrders />} />
        <Route path="/orders/new" element={<CreatePurchaseOrder />} />
        <Route path="/orders/:id" element={<PurchaseOrderDetail />} />
        {/* Redirect old routes */}
        <Route path="/purchase-orders" element={<Navigate to="/orders" replace />} />
        <Route path="/purchase-orders/*" element={<Navigate to="/orders" replace />} />
        <Route path="/po-groups" element={<POGroups />} />
        <Route path="/po-groups/new" element={<POGroupDetail />} />
        <Route path="/po-groups/:id" element={<POGroupDetail />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/sales" element={<SalesOrders />} />
        <Route path="/sales/new" element={<CreateSalesOrder />} />
        <Route path="/sales/:id" element={<SalesOrderDetail />} />
        <Route path="/assemblies" element={<Assemblies />} />
        <Route path="/reconciliation" element={<Reconciliation />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/setup/:orgId" element={<OrgSetupWizard />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
