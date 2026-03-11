import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ComboBox, type ComboBoxOption } from "@/components/ComboBox";
import { Plus, Trash2, Pencil, FlaskConical, RotateCcw, AlertTriangle, Copy, ArrowLeft, Bot } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TemplateAssistantPanel, type TemplateFieldUpdates } from "@/components/TemplateAssistantPanel";

const ALL_ROLES = ["admin", "procurement", "sales", "finance", "employee"] as const;

export default function SettingsPage() {
  const { user, profile, roles, orgId, refreshRoles } = useAuth();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isSuperAdmin = roles.includes("superadmin");
  const isAdmin = roles.includes("admin") || isSuperAdmin;
  const canManageSuppliers = isAdmin || roles.includes("procurement");
  const canManageUnits = isAdmin || roles.includes("procurement");

  // ---- Confirm dialog state ----
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);

  // ---- Super Admin: Seed Demo ----
  const [seeding, setSeeding] = useState(false);

  const seedDemo = async () => {
    setConfirmAction({
      message: "This will clear all existing Innovex demo data and reseed from scratch. Continue?",
      onConfirm: async () => {
        setConfirmAction(null);
        setSeeding(true);
        try {
          const { data, error } = await supabase.functions.invoke("seed-demo");
          if (error) throw error;
          const counts = data?.counts;
          const desc = counts
            ? `Created ${counts.users} users, ${counts.inventory_items} items, ${counts.purchase_orders} POs, ${counts.sales_orders} SOs, ${counts.assembly_records} assemblies`
            : "Success";
          toast({ title: "Demo data reset complete", description: desc });
        } catch (e: any) {
          toast({ title: "Seed failed", description: e.message, variant: "destructive" });
        }
        setSeeding(false);
      },
    });
  };

  // ---- Super Admin: Tenant List ----
  const { data: tenants } = useQuery({
    queryKey: ["tenants"], enabled: isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_all_organizations");
      if (error) throw error;
      return data ?? [];
    },
  });

  // ---- Super Admin: Org CRUD ----
  const [orgDialog, setOrgDialog] = useState(false);
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [orgForm, setOrgForm] = useState({ name: "", industry: "" });
  const [orgSaving, setOrgSaving] = useState(false);

  const openOrgDialog = (org?: any) => {
    if (org) {
      setEditingOrgId(org.id);
      setOrgForm({ name: org.name, industry: org.industry ?? "" });
    } else {
      setEditingOrgId(null);
      setOrgForm({ name: "", industry: "" });
    }
    setOrgDialog(true);
  };

  const saveOrg = async () => {
    if (!orgForm.name.trim()) return;
    setOrgSaving(true);
    const payload = { name: orgForm.name.trim(), industry: orgForm.industry.trim() || null };
    if (editingOrgId) {
      const { error } = await supabase.from("organizations").update(payload).eq("id", editingOrgId);
      setOrgSaving(false);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Organization updated" });
      setOrgDialog(false);
      qc.invalidateQueries({ queryKey: ["tenants"] });
    } else {
      const { data, error } = await supabase.from("organizations").insert(payload).select().single();
      setOrgSaving(false);
      if (error || !data) { toast({ title: "Error", description: error?.message ?? "Failed to create", variant: "destructive" }); return; }
      toast({ title: "Organization created" });
      setOrgDialog(false);
      qc.invalidateQueries({ queryKey: ["tenants"] });
      navigate(`/setup/${data.id}`);
    }
  };

  const deleteOrg = async (id: string, name: string) => {
    setConfirmAction({
      message: `Delete organization "${name}"? This will remove all associated data.`,
      onConfirm: async () => {
        setConfirmAction(null);
        const { error } = await supabase.from("organizations").delete().eq("id", id);
        if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
        toast({ title: "Organization deleted" });
        qc.invalidateQueries({ queryKey: ["tenants"] });
      },
    });
  };

  // ---- Departments ----
  const [deptDialog, setDeptDialog] = useState(false);
  const [deptName, setDeptName] = useState("");
  const [deptSaving, setDeptSaving] = useState(false);

  const { data: departments } = useQuery({
    queryKey: ["departments", orgId], enabled: !!orgId && isAdmin,
    queryFn: async () => { const { data } = await supabase.from("departments").select("*").order("name"); return data ?? []; },
  });

  const saveDept = async () => {
    if (!deptName.trim() || !orgId) return;
    setDeptSaving(true);
    const { error } = await supabase.from("departments").insert({ name: deptName.trim(), organization_id: orgId });
    setDeptSaving(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Department added" }); setDeptName(""); setDeptDialog(false);
    qc.invalidateQueries({ queryKey: ["departments"] });
  };

  const deleteDept = async (id: string, name: string) => {
    setConfirmAction({
      message: `Delete department "${name}"?`,
      onConfirm: async () => {
        setConfirmAction(null);
        const { error } = await supabase.from("departments").delete().eq("id", id);
        if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
        toast({ title: "Deleted" }); qc.invalidateQueries({ queryKey: ["departments"] });
      },
    });
  };

  // ---- Users & Roles ----
  const [roleDialog, setRoleDialog] = useState<string | null>(null);
  const [checkedRoles, setCheckedRoles] = useState<string[]>([]);
  const [editingUserDept, setEditingUserDept] = useState<ComboBoxOption | null>(null);
  const [roleSaving, setRoleSaving] = useState(false);

  const { data: orgProfiles } = useQuery({
    queryKey: ["org-profiles", orgId], enabled: !!orgId && isAdmin,
    queryFn: async () => { const { data } = await supabase.from("profiles").select("*").order("full_name"); return data ?? []; },
  });

  const { data: allUserRoles } = useQuery({
    queryKey: ["all-user-roles", orgId], enabled: !!orgId && isAdmin,
    queryFn: async () => { const { data } = await supabase.from("user_roles").select("*"); return data ?? []; },
  });

  const getRolesFor = (userId: string) => (allUserRoles ?? []).filter((r: any) => r.user_id === userId).map((r: any) => r.role);

  const openRoleDialog = (userId: string) => {
    setRoleDialog(userId);
    setCheckedRoles(getRolesFor(userId));
    const prof = orgProfiles?.find((p: any) => p.user_id === userId);
    if (prof?.department_id) {
      const dept = departments?.find((d: any) => d.id === prof.department_id);
      setEditingUserDept(dept ? { id: dept.id, label: dept.name } : null);
    } else {
      setEditingUserDept(null);
    }
  };

  const searchDepartmentsForUser = async (q: string): Promise<ComboBoxOption[]> => {
    const { data } = await supabase
      .from("departments")
      .select("id, name")
      .ilike("name", `%${q}%`)
      .limit(20);
    return (data ?? []).map((d) => ({ id: d.id, label: d.name }));
  };

  const saveRoles = async () => {
    if (!roleDialog || !orgId) return;
    if (roleDialog === user?.id && !checkedRoles.includes("admin")) {
      toast({ title: "Cannot remove your own admin role", variant: "destructive" }); return;
    }
    setRoleSaving(true);
    const { error } = await supabase.rpc("update_user_roles", {
      _target_user_id: roleDialog,
      _organization_id: orgId,
      _new_roles: checkedRoles as any,
    });
    await supabase
      .from("profiles")
      .update({ department_id: editingUserDept?.id ?? null })
      .eq("user_id", roleDialog);
    if (error) {
      toast({ title: "Failed to update roles", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Roles updated" });
      if (roleDialog === user?.id) {
        await refreshRoles();
      }
    }
    setRoleSaving(false);
    setRoleDialog(null);
    qc.invalidateQueries({ queryKey: ["all-user-roles"] });
    qc.invalidateQueries({ queryKey: ["org-profiles"] });
  };

  // ---- Suppliers ----
  const [supplierDialog, setSupplierDialog] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [sForm, setSForm] = useState({ name: "", contact_name: "", contact_email: "", contact_phone: "" });
  const [sSaving, setSSaving] = useState(false);

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers", orgId], enabled: !!orgId && canManageSuppliers,
    queryFn: async () => { const { data } = await supabase.from("suppliers").select("*").order("name"); return data ?? []; },
  });

  const openSupplierDialog = (s?: any) => {
    if (s) {
      setEditingSupplierId(s.id);
      setSForm({ name: s.name, contact_name: s.contact_name || "", contact_email: s.contact_email || "", contact_phone: s.contact_phone || "" });
    } else {
      setEditingSupplierId(null);
      setSForm({ name: "", contact_name: "", contact_email: "", contact_phone: "" });
    }
    setSupplierDialog(true);
  };

  const saveSupplier = async () => {
    if (!sForm.name.trim() || !orgId) return;
    setSSaving(true);
    const payload = { name: sForm.name.trim(), contact_name: sForm.contact_name || null, contact_email: sForm.contact_email || null, contact_phone: sForm.contact_phone || null, organization_id: orgId };
    const { error } = editingSupplierId
      ? await supabase.from("suppliers").update(payload).eq("id", editingSupplierId)
      : await supabase.from("suppliers").insert(payload);
    setSSaving(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: editingSupplierId ? "Supplier updated" : "Supplier added" });
    setSupplierDialog(false); qc.invalidateQueries({ queryKey: ["suppliers"] });
  };

  // ---- Approval Rules ----
  const [ruleDialog, setRuleDialog] = useState(false);
  const [ruleForm, setRuleForm] = useState({ department_id: "", min_amount: "0", max_amount: "", required_role: "admin" as string, approver_user_id: "" });
  const [ruleSaving, setRuleSaving] = useState(false);
  const [testRuleDialog, setTestRuleDialog] = useState(false);
  const [testAmount, setTestAmount] = useState("");
  const [testDeptId, setTestDeptId] = useState("");
  const [testResult, setTestResult] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);

  const { data: approvalRules } = useQuery({
    queryKey: ["approval-rules", orgId], enabled: !!orgId && isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("approval_rules").select("*, departments:department_id(name)").order("min_amount");
      return data ?? [];
    },
  });

  const runTestRule = async () => {
    if (!orgId) return;
    setTestLoading(true);
    const { data } = await supabase.rpc("get_approval_rule", {
      _org_id: orgId,
      _department_id: testDeptId || null,
      _total_amount: parseFloat(testAmount) || 0,
    });
    setTestResult(data?.[0] ?? null);
    setTestLoading(false);
  };

  const saveRule = async () => {
    if (!orgId) return;
    setRuleSaving(true);
    const { error } = await supabase.from("approval_rules").insert({
      organization_id: orgId,
      department_id: ruleForm.department_id || null,
      min_amount: parseFloat(ruleForm.min_amount) || 0,
      max_amount: ruleForm.max_amount ? parseFloat(ruleForm.max_amount) : null,
      required_role: ruleForm.required_role as any,
      approver_user_id: ruleForm.approver_user_id || null,
    });
    setRuleSaving(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Rule added" }); setRuleDialog(false);
    setRuleForm({ department_id: "", min_amount: "0", max_amount: "", required_role: "admin", approver_user_id: "" });
    qc.invalidateQueries({ queryKey: ["approval-rules"] });
  };

  const deleteRule = async (id: string) => {
    setConfirmAction({
      message: "Delete this approval rule?",
      onConfirm: async () => {
        setConfirmAction(null);
        await supabase.from("approval_rules").delete().eq("id", id);
        qc.invalidateQueries({ queryKey: ["approval-rules"] });
        toast({ title: "Rule deleted" });
      },
    });
  };

  // ---- Units ----
  const [unitDialog, setUnitDialog] = useState(false);
  const [unitForm, setUnitForm] = useState({ unit_number: "", description: "" });
  const [unitSaving, setUnitSaving] = useState(false);

  const { data: units } = useQuery({
    queryKey: ["units", orgId], enabled: !!orgId && canManageUnits,
    queryFn: async () => { const { data } = await supabase.from("units").select("*").order("unit_number"); return data ?? []; },
  });

  const saveUnit = async () => {
    if (!unitForm.unit_number.trim() || !orgId) return;
    setUnitSaving(true);
    const { error } = await supabase.from("units").insert({ unit_number: unitForm.unit_number.trim(), description: unitForm.description || null, organization_id: orgId });
    setUnitSaving(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Unit added" }); setUnitDialog(false); setUnitForm({ unit_number: "", description: "" });
    qc.invalidateQueries({ queryKey: ["units"] });
  };

  // ---- Report Templates ----
  const [rtEditId, setRtEditId] = useState<string | null>(null);
  const [rtEditForm, setRtEditForm] = useState<any>({});
  const [rtSaving, setRtSaving] = useState(false);
  const [rtNewOpen, setRtNewOpen] = useState(false);
  const [rtNewForm, setRtNewForm] = useState({
    name: "", description: "", access_level: "admin", chart_type: "table",
    supports_date_range: true, sql_query: "",
  });

  const { data: systemTemplates } = useQuery({
    queryKey: ["system-report-templates"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("report_templates").select("*").is("organization_id", null).order("name");
      return data ?? [];
    },
  });

  const { data: orgTemplates } = useQuery({
    queryKey: ["org-report-templates", orgId],
    enabled: !!orgId && isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("report_templates").select("*").eq("organization_id", orgId!).order("name");
      return data ?? [];
    },
  });

  const orgOverrideMap = new Map((orgTemplates ?? []).filter((t: any) => t.source_template_id).map((t: any) => [t.source_template_id, t]));

  const customizeSystemTemplate = async (sysTemplate: any) => {
    if (!orgId) return;
    setRtSaving(true);
    const { error } = await supabase.from("report_templates").insert({
      organization_id: orgId,
      name: sysTemplate.name,
      description: sysTemplate.description,
      access_level: sysTemplate.access_level,
      chart_type: sysTemplate.chart_type,
      sql_query: sysTemplate.sql_query,
      supports_date_range: sysTemplate.supports_date_range,
      supports_quarterly: sysTemplate.supports_quarterly,
      source_template_id: sysTemplate.id,
    } as any);
    setRtSaving(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Override created", description: "You can now edit this template from the Organization Templates tab." });
    qc.invalidateQueries({ queryKey: ["org-report-templates"] });
  };

  const saveRtEdit = async () => {
    if (!rtEditId) return;
    setRtSaving(true);
    const { error } = await supabase.from("report_templates").update({
      name: rtEditForm.name, description: rtEditForm.description || null,
      access_level: rtEditForm.access_level, chart_type: rtEditForm.chart_type,
      sql_query: rtEditForm.sql_query,
      supports_date_range: rtEditForm.supports_date_range,
    } as any).eq("id", rtEditId);
    setRtSaving(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Template updated" });
    setRtEditId(null);
    qc.invalidateQueries({ queryKey: ["org-report-templates"] });
    qc.invalidateQueries({ queryKey: ["report-templates"] });
  };

  const resetToDefault = async (orgTemplate: any) => {
    const sys = systemTemplates?.find((s: any) => s.id === orgTemplate.source_template_id);
    if (!sys) return;
    setRtSaving(true);
    const { error } = await supabase.from("report_templates").update({
      name: sys.name, description: sys.description, access_level: sys.access_level,
      chart_type: sys.chart_type, sql_query: sys.sql_query,
      supports_date_range: sys.supports_date_range, supports_quarterly: sys.supports_quarterly,
    } as any).eq("id", orgTemplate.id);
    setRtSaving(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Reset to system default" });
    qc.invalidateQueries({ queryKey: ["org-report-templates"] });
    qc.invalidateQueries({ queryKey: ["report-templates"] });
  };

  const deleteOrgTemplate = async (t: any) => {
    const msg = t.source_template_id
      ? "Deleting this override will restore the system default for this report. Continue?"
      : `Delete template "${t.name}"?`;
    setConfirmAction({
      message: msg,
      onConfirm: async () => {
        setConfirmAction(null);
        await supabase.from("report_templates").delete().eq("id", t.id);
        toast({ title: "Template deleted" });
        qc.invalidateQueries({ queryKey: ["org-report-templates"] });
        qc.invalidateQueries({ queryKey: ["report-templates"] });
      },
    });
  };

  const saveNewTemplate = async () => {
    if (!rtNewForm.name.trim() || !rtNewForm.sql_query.trim() || !orgId) return;
    setRtSaving(true);
    const { error } = await supabase.from("report_templates").insert({
      organization_id: orgId,
      name: rtNewForm.name.trim(),
      description: rtNewForm.description || null,
      access_level: rtNewForm.access_level,
      chart_type: rtNewForm.chart_type,
      sql_query: rtNewForm.sql_query,
      supports_date_range: rtNewForm.supports_date_range,
    } as any);
    setRtSaving(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Template created" });
    setRtNewOpen(false);
    setRtNewForm({ name: "", description: "", access_level: "admin", chart_type: "table", supports_date_range: true, sql_query: "" });
    qc.invalidateQueries({ queryKey: ["org-report-templates"] });
    qc.invalidateQueries({ queryKey: ["report-templates"] });
  };

  return (
    <div>
      <PageHeader title="Settings" description="Organization and account configuration" />
      <div className="p-8 max-w-5xl">
        <Tabs defaultValue={searchParams.get("tab") || (isSuperAdmin ? "platform" : "account")}>
          <TabsList className="mb-6">
            {isSuperAdmin && <TabsTrigger value="platform">Platform</TabsTrigger>}
            <TabsTrigger value="account">My Account</TabsTrigger>
            {isAdmin && <TabsTrigger value="departments">Departments</TabsTrigger>}
            {isAdmin && <TabsTrigger value="users">Users & Roles</TabsTrigger>}
            {canManageSuppliers && <TabsTrigger value="suppliers">Suppliers</TabsTrigger>}
            {isAdmin && <TabsTrigger value="approvals">Approval Rules</TabsTrigger>}
            {canManageUnits && <TabsTrigger value="units">Units</TabsTrigger>}
            
            {isAdmin && <TabsTrigger value="report-templates">Report Templates</TabsTrigger>}
          </TabsList>

          {/* Platform (superadmin only) */}
          {isSuperAdmin && (
            <TabsContent value="platform">
              <div className="space-y-6">
                <div className="fieldcore-card p-6">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Demo Data</h3>
                  <p className="text-sm text-muted-foreground mb-3">Clear and reseed the Innovex demo organization with fresh sample data (users, inventory, POs, SOs, assemblies, reconciliations).</p>
                  <Button onClick={seedDemo} disabled={seeding} variant="outline">{seeding ? "Resetting…" : "Reset Demo Data"}</Button>
                </div>
                <div className="fieldcore-card overflow-hidden">
                  <div className="flex items-center justify-between border-b px-5 py-3">
                    <h3 className="text-sm font-semibold text-foreground">Tenant Organizations</h3>
                    <Button size="sm" onClick={() => openOrgDialog()}><Plus className="h-4 w-4" /> Add Organization</Button>
                  </div>
                  <table className="w-full text-sm">
                    <thead><tr className="border-b bg-muted/50">
                      <th className="px-5 py-2 text-left font-medium text-muted-foreground">Name</th>
                      <th className="px-5 py-2 text-left font-medium text-muted-foreground">Industry</th>
                      <th className="px-5 py-2 text-left font-medium text-muted-foreground">Created</th>
                      <th className="px-5 py-2 w-24" />
                    </tr></thead>
                    <tbody className="divide-y">
                      {tenants?.map((t: any) => (
                        <tr key={t.id} className="hover:bg-muted/30">
                          <td className="px-5 py-2 font-medium text-foreground">{t.name}</td>
                          <td className="px-5 py-2 text-muted-foreground">{t.industry ?? "—"}</td>
                          <td className="px-5 py-2 text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</td>
                          <td className="px-5 py-2 flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openOrgDialog(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteOrg(t.id, t.name)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </td>
                        </tr>
                      ))}
                      {(!tenants || tenants.length === 0) && <tr><td colSpan={4} className="px-5 py-6 text-center text-muted-foreground">No tenant organizations</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>
          )}

          {/* My Account */}
          <TabsContent value="account">
            <div className="fieldcore-card p-6 space-y-3">
              <h3 className="text-sm font-semibold text-foreground mb-4">Account Information</h3>
              <div><Label className="text-xs text-muted-foreground">Name</Label><p className="text-sm text-foreground">{profile?.full_name ?? "—"}</p></div>
              <div><Label className="text-xs text-muted-foreground">Email</Label><p className="text-sm text-foreground">{profile?.email ?? "—"}</p></div>
              <div><Label className="text-xs text-muted-foreground">Roles</Label><div className="flex gap-1 mt-1">{roles.map((r) => <Badge key={r} variant="secondary" className="capitalize">{r}</Badge>)}</div></div>
            </div>
          </TabsContent>

          {/* Departments */}
          <TabsContent value="departments">
            <div className="fieldcore-card overflow-hidden">
              <div className="flex items-center justify-between border-b px-5 py-3">
                <h3 className="text-sm font-semibold text-foreground">Departments</h3>
                <Button size="sm" onClick={() => setDeptDialog(true)}><Plus className="h-4 w-4" /> Add Department</Button>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50"><th className="px-5 py-2 text-left font-medium text-muted-foreground">Name</th><th className="px-5 py-2 text-left font-medium text-muted-foreground">Created</th><th className="px-5 py-2 w-16" /></tr></thead>
                <tbody className="divide-y">
                  {departments?.map((d: any) => (
                    <tr key={d.id} className="hover:bg-muted/30">
                      <td className="px-5 py-2 text-foreground">{d.name}</td>
                      <td className="px-5 py-2 text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</td>
                      <td className="px-5 py-2"><Button variant="ghost" size="icon" className="text-destructive h-7 w-7" onClick={() => deleteDept(d.id, d.name)}><Trash2 className="h-3.5 w-3.5" /></Button></td>
                    </tr>
                  ))}
                  {(!departments || departments.length === 0) && <tr><td colSpan={3} className="px-5 py-6 text-center text-muted-foreground">No departments</td></tr>}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Users & Roles */}
          <TabsContent value="users">
            <div className="fieldcore-card overflow-hidden">
              <div className="border-b px-5 py-3"><h3 className="text-sm font-semibold text-foreground">Users & Roles</h3></div>
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50"><th className="px-5 py-2 text-left font-medium text-muted-foreground">Name</th><th className="px-5 py-2 text-left font-medium text-muted-foreground">Email</th><th className="px-5 py-2 text-left font-medium text-muted-foreground">Roles</th><th className="px-5 py-2 w-24" /></tr></thead>
                <tbody className="divide-y">
                  {orgProfiles?.map((p: any) => (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="px-5 py-2 text-foreground">{p.full_name}</td>
                      <td className="px-5 py-2 text-muted-foreground">{p.email}</td>
                      <td className="px-5 py-2"><div className="flex gap-1 flex-wrap">{getRolesFor(p.user_id).map((r: string) => <Badge key={r} variant="outline" className="capitalize text-xs">{r}</Badge>)}</div></td>
                      <td className="px-5 py-2"><Button variant="ghost" size="sm" onClick={() => openRoleDialog(p.user_id)}><Pencil className="h-3.5 w-3.5 mr-1" />Roles</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Suppliers */}
          <TabsContent value="suppliers">
            <div className="fieldcore-card overflow-hidden">
              <div className="flex items-center justify-between border-b px-5 py-3">
                <h3 className="text-sm font-semibold text-foreground">Suppliers</h3>
                <Button size="sm" onClick={() => openSupplierDialog()}><Plus className="h-4 w-4" /> Add Supplier</Button>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50">
                  <th className="px-5 py-2 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-5 py-2 text-left font-medium text-muted-foreground">Contact</th>
                  <th className="px-5 py-2 text-left font-medium text-muted-foreground">Email</th>
                  <th className="px-5 py-2 text-left font-medium text-muted-foreground">Phone</th>
                  <th className="px-5 py-2 text-left font-medium text-muted-foreground">Lead Time</th>
                  <th className="px-5 py-2 w-16" />
                </tr></thead>
                <tbody className="divide-y">
                  {suppliers?.map((s: any) => (
                    <tr key={s.id} className="hover:bg-muted/30">
                      <td className="px-5 py-2 font-medium text-foreground">{s.name}</td>
                      <td className="px-5 py-2 text-muted-foreground">{s.contact_name ?? "—"}</td>
                      <td className="px-5 py-2 text-muted-foreground">{s.contact_email ?? "—"}</td>
                      <td className="px-5 py-2 text-muted-foreground">{s.contact_phone ?? "—"}</td>
                      <td className="px-5 py-2 text-muted-foreground">{s.avg_lead_time_days ? `${s.avg_lead_time_days}d` : "—"}</td>
                      <td className="px-5 py-2"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openSupplierDialog(s)}><Pencil className="h-3.5 w-3.5" /></Button></td>
                    </tr>
                  ))}
                  {(!suppliers || suppliers.length === 0) && <tr><td colSpan={6} className="px-5 py-6 text-center text-muted-foreground">No suppliers</td></tr>}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Approval Rules */}
          <TabsContent value="approvals">
            <div className="fieldcore-card overflow-hidden">
              <div className="flex items-center justify-between border-b px-5 py-3">
                <h3 className="text-sm font-semibold text-foreground">Approval Rules</h3>
                <Button size="sm" onClick={() => setRuleDialog(true)}><Plus className="h-4 w-4" /> Add Rule</Button>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50">
                  <th className="px-5 py-2 text-left font-medium text-muted-foreground">Department</th>
                  <th className="px-5 py-2 text-left font-medium text-muted-foreground">Min Amount</th>
                  <th className="px-5 py-2 text-left font-medium text-muted-foreground">Max Amount</th>
                  <th className="px-5 py-2 text-left font-medium text-muted-foreground">Required Role</th>
                  <th className="px-5 py-2 w-16" />
                </tr></thead>
                <tbody className="divide-y">
                  {approvalRules?.map((r: any) => (
                    <tr key={r.id} className="hover:bg-muted/30">
                      <td className="px-5 py-2 text-foreground">{r.departments?.name ?? "All"}</td>
                      <td className="px-5 py-2 text-foreground">${Number(r.min_amount).toLocaleString()}</td>
                      <td className="px-5 py-2 text-foreground">{r.max_amount != null ? `$${Number(r.max_amount).toLocaleString()}` : "No limit"}</td>
                      <td className="px-5 py-2"><Badge variant="outline" className="capitalize">{r.required_role}</Badge></td>
                      <td className="px-5 py-2"><Button variant="ghost" size="icon" className="text-destructive h-7 w-7" onClick={() => deleteRule(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button></td>
                    </tr>
                  ))}
                  {(!approvalRules || approvalRules.length === 0) && <tr><td colSpan={5} className="px-5 py-6 text-center text-muted-foreground">No approval rules configured</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="mt-4 px-5 pb-4 flex items-start justify-between gap-4">
              <p className="text-xs text-muted-foreground max-w-xl">
                Rules are matched by amount and department. Department-specific rules take priority over org-wide rules. If no rule matches a PO's amount, the order is auto-approved. If no rules are configured at all, all orders are created without approval. Admins can always approve any order.
              </p>
              <Button variant="outline" size="sm" onClick={() => setTestRuleDialog(true)}>
                <FlaskConical className="h-4 w-4" /> Test Rule
              </Button>
            </div>
          </TabsContent>

          {/* Units */}
          <TabsContent value="units">
            <div className="fieldcore-card overflow-hidden">
              <div className="flex items-center justify-between border-b px-5 py-3">
                <h3 className="text-sm font-semibold text-foreground">Units</h3>
                <Button size="sm" onClick={() => setUnitDialog(true)}><Plus className="h-4 w-4" /> Add Unit</Button>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50"><th className="px-5 py-2 text-left font-medium text-muted-foreground">Unit Number</th><th className="px-5 py-2 text-left font-medium text-muted-foreground">Description</th></tr></thead>
                <tbody className="divide-y">
                  {units?.map((u: any) => (
                    <tr key={u.id} className="hover:bg-muted/30">
                      <td className="px-5 py-2 font-medium text-foreground">{u.unit_number}</td>
                      <td className="px-5 py-2 text-muted-foreground">{u.description ?? "—"}</td>
                    </tr>
                  ))}
                  {(!units || units.length === 0) && <tr><td colSpan={2} className="px-5 py-6 text-center text-muted-foreground">No units</td></tr>}
                </tbody>
              </table>
            </div>
          </TabsContent>

          

          {/* Report Templates (admin only) */}
          {isAdmin && (
            <TabsContent value="report-templates">
              <Tabs defaultValue="system-templates">
                <TabsList className="mb-4">
                  <TabsTrigger value="system-templates">System Templates</TabsTrigger>
                  <TabsTrigger value="org-templates">Organization Templates</TabsTrigger>
                </TabsList>

                {/* System Templates Sub-tab */}
                <TabsContent value="system-templates">
                  <div className="fieldcore-card overflow-hidden">
                    <div className="border-b px-5 py-3">
                      <h3 className="text-sm font-semibold text-foreground">System Templates</h3>
                      <p className="text-xs text-muted-foreground mt-1">Read-only base templates. Use "+ Override" to create an editable org-level copy.</p>
                    </div>
                    <table className="w-full text-sm">
                      <thead><tr className="border-b bg-muted/50">
                        <th className="px-5 py-2 text-left font-medium text-muted-foreground">Name</th>
                        <th className="px-5 py-2 text-left font-medium text-muted-foreground">Chart</th>
                        <th className="px-5 py-2 text-left font-medium text-muted-foreground">Access</th>
                        <th className="px-5 py-2 w-40" />
                      </tr></thead>
                      <tbody className="divide-y">
                        {systemTemplates?.map((st: any) => {
                          const override = orgOverrideMap.get(st.id);
                          return (
                            <tr key={st.id} className="hover:bg-muted/30">
                              <td className="px-5 py-2">
                                <p className="font-medium text-foreground">{st.name}</p>
                                {st.description && <p className="text-xs text-muted-foreground">{st.description}</p>}
                              </td>
                              <td className="px-5 py-2 text-muted-foreground capitalize">{st.chart_type}</td>
                              <td className="px-5 py-2"><Badge variant="outline" className="capitalize">{st.access_level}</Badge></td>
                              <td className="px-5 py-2 text-right">
                                {override ? (
                                  <Badge className="bg-primary/10 text-primary border-primary/20">Override Active</Badge>
                                ) : (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button size="sm" variant="outline" disabled={rtSaving} onClick={() => customizeSystemTemplate(st)}>
                                          <Plus className="h-3.5 w-3.5" /> Override
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent side="left" className="max-w-[260px]">
                                        <p>Creates an organization-level copy you can edit from the Organization Templates tab.</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {(!systemTemplates || systemTemplates.length === 0) && (
                          <tr><td colSpan={4} className="px-5 py-6 text-center text-muted-foreground">No system templates</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                {/* Organization Templates Sub-tab */}
                <TabsContent value="org-templates">
                  <div className="fieldcore-card overflow-hidden">
                    {/* Show form (create or edit) OR list, never both */}
                    {rtNewOpen ? (
                      /* New Custom Template Form */
                      <div className="p-6 space-y-4">
                        <div className="flex items-center gap-3">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRtNewOpen(false)}><ArrowLeft className="h-4 w-4" /></Button>
                          <h3 className="text-sm font-semibold text-foreground">New Custom Template</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><Label>Name *</Label><Input value={rtNewForm.name} onChange={(e) => setRtNewForm({ ...rtNewForm, name: e.target.value })} placeholder="e.g. Custom Spending Report" /></div>
                          <div><Label>Description</Label><Input value={rtNewForm.description} onChange={(e) => setRtNewForm({ ...rtNewForm, description: e.target.value })} /></div>
                          <div>
                            <Label>Access Level</Label>
                            <Select value={rtNewForm.access_level} onValueChange={(v) => setRtNewForm({ ...rtNewForm, access_level: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>{ALL_ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Chart Type</Label>
                            <Select value={rtNewForm.chart_type} onValueChange={(v) => setRtNewForm({ ...rtNewForm, chart_type: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="table">Table</SelectItem>
                                <SelectItem value="bar">Bar Chart</SelectItem>
                                <SelectItem value="line">Line Chart</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <div className="flex items-center gap-2"><Checkbox checked={rtNewForm.supports_date_range} onCheckedChange={(v) => setRtNewForm({ ...rtNewForm, supports_date_range: !!v })} /><Label>Supports Date Filtering</Label></div>
                          <p className="text-xs text-muted-foreground self-center">Enables date range picker and quarterly presets on the report</p>
                        </div>
                        <ReportSqlAssistant
                          sqlQuery={rtNewForm.sql_query}
                          onSqlChange={(sql) => setRtNewForm({ ...rtNewForm, sql_query: sql })}
                          accessLevel={rtNewForm.access_level}
                        />
                        <div className="flex gap-2">
                          <Button onClick={saveNewTemplate} disabled={rtSaving || !rtNewForm.name.trim() || !rtNewForm.sql_query.trim()}>{rtSaving ? "Creating..." : "Create Template"}</Button>
                          <Button variant="outline" onClick={() => setRtNewOpen(false)}>Cancel</Button>
                        </div>
                      </div>
                    ) : rtEditId ? (
                      /* Edit Template Form */
                      <div className="p-6 space-y-4">
                        <div className="flex items-center gap-3">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRtEditId(null)}><ArrowLeft className="h-4 w-4" /></Button>
                          <h3 className="text-sm font-semibold text-foreground">Edit Template</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><Label>Name *</Label><Input value={rtEditForm.name} onChange={(e) => setRtEditForm({ ...rtEditForm, name: e.target.value })} /></div>
                          <div><Label>Description</Label><Input value={rtEditForm.description} onChange={(e) => setRtEditForm({ ...rtEditForm, description: e.target.value })} /></div>
                          <div>
                            <Label>Access Level</Label>
                            <Select value={rtEditForm.access_level} onValueChange={(v) => setRtEditForm({ ...rtEditForm, access_level: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>{ALL_ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Chart Type</Label>
                            <Select value={rtEditForm.chart_type} onValueChange={(v) => setRtEditForm({ ...rtEditForm, chart_type: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="table">Table</SelectItem>
                                <SelectItem value="bar">Bar Chart</SelectItem>
                                <SelectItem value="line">Line Chart</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <div className="flex items-center gap-2"><Checkbox checked={rtEditForm.supports_date_range} onCheckedChange={(v) => setRtEditForm({ ...rtEditForm, supports_date_range: !!v })} /><Label>Supports Date Filtering</Label></div>
                          <p className="text-xs text-muted-foreground self-center">Enables date range picker and quarterly presets on the report</p>
                        </div>
                        <ReportSqlAssistant
                          sqlQuery={rtEditForm.sql_query}
                          onSqlChange={(sql) => setRtEditForm({ ...rtEditForm, sql_query: sql })}
                          accessLevel={rtEditForm.access_level}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveRtEdit} disabled={rtSaving || !rtEditForm.name?.trim() || !rtEditForm.sql_query?.trim()}>{rtSaving ? "Saving..." : "Save"}</Button>
                          <Button size="sm" variant="outline" onClick={() => setRtEditId(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      /* Org Templates List */
                      <>
                        <div className="flex items-center justify-between border-b px-5 py-3">
                          <div>
                            <h3 className="text-sm font-semibold text-foreground">Organization Templates</h3>
                            <p className="text-xs text-muted-foreground mt-1">Custom or overridden templates for your org.</p>
                          </div>
                          <Button size="sm" onClick={() => setRtNewOpen(true)}><Plus className="h-4 w-4" /> Add Custom Template</Button>
                        </div>
                        <div className="divide-y">
                          {orgTemplates?.map((t: any) => {
                            const sysName = t.source_template_id ? systemTemplates?.find((s: any) => s.id === t.source_template_id)?.name : null;
                            return (
                              <div key={t.id} className="px-5 py-3">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0">
                                    <p className="font-medium text-foreground">{t.name}</p>
                                    {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                                    <div className="flex items-center gap-2 mt-1">
                                      <Badge variant="outline" className="capitalize text-xs">{t.chart_type}</Badge>
                                      <Badge variant="outline" className="capitalize text-xs">{t.access_level}</Badge>
                                      {sysName && <span className="text-xs text-muted-foreground">Override of: {sysName}</span>}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setRtEditId(t.id); setRtEditForm({ name: t.name, description: t.description ?? "", access_level: t.access_level, chart_type: t.chart_type, sql_query: t.sql_query, supports_date_range: t.supports_date_range ?? true }); }}><Pencil className="h-3.5 w-3.5" /></Button>
                                    {t.source_template_id && (
                                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Reset to default" onClick={() => resetToDefault(t)} disabled={rtSaving}><RotateCcw className="h-3.5 w-3.5" /></Button>
                                    )}
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteOrgTemplate(t)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {(!orgTemplates || orgTemplates.length === 0) && (
                            <div className="px-5 py-6 text-center text-muted-foreground text-sm">No org templates — use "+ Override" on a system template or create a custom one.</div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Department Dialog */}
      <Dialog open={deptDialog} onOpenChange={setDeptDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Department</DialogTitle></DialogHeader>
          <div><Label>Department Name</Label><Input value={deptName} onChange={(e) => setDeptName(e.target.value)} placeholder="e.g. Manufacturing" /></div>
          <DialogFooter><Button onClick={saveDept} disabled={deptSaving || !deptName.trim()}>{deptSaving ? "Saving..." : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Edit Dialog */}
      <Dialog open={!!roleDialog} onOpenChange={() => setRoleDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {ALL_ROLES.map((r) => (
              <div key={r} className="flex items-center gap-2">
                <Checkbox
                  id={`role-${r}`}
                  checked={checkedRoles.includes(r)}
                  onCheckedChange={(checked) => {
                    setCheckedRoles((prev) => checked ? [...prev, r] : prev.filter((x) => x !== r));
                  }}
                />
                <label htmlFor={`role-${r}`} className="text-sm capitalize cursor-pointer">{r}</label>
              </div>
            ))}
            <div className="space-y-2 pt-2">
              <Label>Department</Label>
              <ComboBox
                value={editingUserDept}
                onChange={setEditingUserDept}
                onSearch={searchDepartmentsForUser}
                placeholder="Assign to department (optional)..."
              />
              {editingUserDept && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => setEditingUserDept(null)}
                >
                  Clear department assignment
                </button>
              )}
            </div>
          </div>
          <DialogFooter><Button onClick={saveRoles} disabled={roleSaving}>{roleSaving ? "Saving..." : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Supplier Dialog */}
      <Dialog open={supplierDialog} onOpenChange={setSupplierDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingSupplierId ? "Edit Supplier" : "Add Supplier"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={sForm.name} onChange={(e) => setSForm({ ...sForm, name: e.target.value })} /></div>
            <div><Label>Contact Name</Label><Input value={sForm.contact_name} onChange={(e) => setSForm({ ...sForm, contact_name: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={sForm.contact_email} onChange={(e) => setSForm({ ...sForm, contact_email: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={sForm.contact_phone} onChange={(e) => setSForm({ ...sForm, contact_phone: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={saveSupplier} disabled={sSaving || !sForm.name.trim()}>{sSaving ? "Saving..." : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval Rule Dialog */}
      <Dialog open={ruleDialog} onOpenChange={setRuleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Approval Rule</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Department (optional — leave empty for all)</Label>
              <Select value={ruleForm.department_id} onValueChange={(v) => setRuleForm({ ...ruleForm, department_id: v })}>
                <SelectTrigger><SelectValue placeholder="All departments" /></SelectTrigger>
                <SelectContent>
                  {departments?.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Min Amount</Label><Input type="number" value={ruleForm.min_amount} onChange={(e) => setRuleForm({ ...ruleForm, min_amount: e.target.value })} /></div>
              <div><Label>Max Amount (blank = no limit)</Label><Input type="number" value={ruleForm.max_amount} onChange={(e) => setRuleForm({ ...ruleForm, max_amount: e.target.value })} /></div>
            </div>
            <div>
              <Label>Required Role</Label>
              <Select value={ruleForm.required_role} onValueChange={(v) => setRuleForm({ ...ruleForm, required_role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ALL_ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={saveRule} disabled={ruleSaving}>{ruleSaving ? "Saving..." : "Save Rule"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unit Dialog */}
      <Dialog open={unitDialog} onOpenChange={setUnitDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Unit</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Unit Number *</Label><Input value={unitForm.unit_number} onChange={(e) => setUnitForm({ ...unitForm, unit_number: e.target.value })} placeholder="e.g. TRUCK-001" /></div>
            <div><Label>Description</Label><Input value={unitForm.description} onChange={(e) => setUnitForm({ ...unitForm, description: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={saveUnit} disabled={unitSaving || !unitForm.unit_number.trim()}>{unitSaving ? "Saving..." : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Organization Dialog */}
      <Dialog open={orgDialog} onOpenChange={setOrgDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingOrgId ? "Edit Organization" : "Create Organization"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={orgForm.name} onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })} placeholder="e.g. Acme Corp" /></div>
            <div><Label>Industry</Label><Input value={orgForm.industry} onChange={(e) => setOrgForm({ ...orgForm, industry: e.target.value })} placeholder="e.g. Manufacturing" /></div>
          </div>
          <DialogFooter><Button onClick={saveOrg} disabled={orgSaving || !orgForm.name.trim()}>{orgSaving ? "Saving..." : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Rule Dialog */}
      <Dialog open={testRuleDialog} onOpenChange={(open) => { setTestRuleDialog(open); if (!open) setTestResult(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Test Approval Rule</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Amount ($)</Label>
              <Input type="number" value={testAmount} onChange={(e) => setTestAmount(e.target.value)} placeholder="e.g. 5000" />
            </div>
            <div>
              <Label>Department (optional)</Label>
              <Select value={testDeptId} onValueChange={setTestDeptId}>
                <SelectTrigger><SelectValue placeholder="Any department" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (org-wide)</SelectItem>
                  {departments?.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={runTestRule} disabled={testLoading || !testAmount} className="w-full">
              {testLoading ? "Testing..." : "Test"}
            </Button>
            {testResult && (
              <div className="rounded-md border p-3 text-sm">
                {testResult.auto_approve ? (
                  <p className="text-muted-foreground">✅ Auto-approved (no matching rule)</p>
                ) : (
                  <p className="text-foreground">
                    🔒 Requires <span className="font-medium capitalize">{testResult.required_role}</span> approval — {testResult.rule_is_department_scoped ? "department only" : "org-wide"}
                  </p>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <Dialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Confirm</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{confirmAction?.message}</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => confirmAction?.onConfirm()}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
