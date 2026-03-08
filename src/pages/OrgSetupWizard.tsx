import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";

const TOTAL_STEPS = 6;

const PURCHASE_TYPES = [
  { id: "resale", label: "Resale" },
  { id: "internal_use", label: "Internal Use" },
  { id: "manufacturing_input", label: "Manufacturing" },
  { id: "consumable", label: "Consumables" },
] as const;

export default function OrgSetupWizard() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [industry, setIndustry] = useState("");
  // Step 2
  const [purchaseTypes, setPurchaseTypes] = useState<string[]>([]);
  // Step 3
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [approvalThreshold, setApprovalThreshold] = useState("");
  const [approvalRole, setApprovalRole] = useState("admin");
  // Step 4
  const [hasDepartments, setHasDepartments] = useState(false);
  const [departmentNames, setDepartmentNames] = useState("");
  // Step 5
  const [tracksInventory, setTracksInventory] = useState(false);
  const [hasSalesTeam, setHasSalesTeam] = useState(false);
  // Step 6
  const [policyAccepted, setPolicyAccepted] = useState(false);

  const togglePurchaseType = (id: string) => {
    setPurchaseTypes((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const canGoNext = () => {
    if (step === 1) return industry.trim().length > 0;
    if (step === 3 && requiresApproval) return !!approvalThreshold && parseFloat(approvalThreshold) > 0;
    if (step === 4 && hasDepartments) return departmentNames.trim().length > 0;
    if (step === 6) return policyAccepted;
    return true;
  };

  const handleFinish = async () => {
    if (!orgId) return;
    setSaving(true);

    try {
      // Update org industry and mark onboarded
      await supabase
        .from("organizations")
        .update({ industry: industry.trim(), is_onboarded: true } as any)
        .eq("id", orgId);

      // Create departments
      if (hasDepartments && departmentNames.trim()) {
        const names = departmentNames
          .split(",")
          .map((n) => n.trim())
          .filter(Boolean);
        if (names.length > 0) {
          await supabase
            .from("departments")
            .insert(names.map((name) => ({ name, organization_id: orgId })));
        }
      }

      // Create approval rule
      if (requiresApproval && approvalThreshold) {
        await supabase.from("approval_rules").insert({
          organization_id: orgId,
          min_amount: parseFloat(approvalThreshold),
          required_role: approvalRole as any,
        });
      }

      toast({ title: "Setup Complete", description: "Organization has been configured successfully." });
      navigate("/settings");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-xl">
        {/* Progress */}
        <div className="mb-6 text-center">
          <p className="text-sm font-medium text-muted-foreground mb-2">
            Step {step} of {TOTAL_STEPS}
          </p>
          <div className="flex gap-1.5 justify-center">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 w-10 rounded-full transition-colors ${
                  i < step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="fieldcore-card p-8 space-y-6">
          {/* Step 1 — Industry */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">What industry is your business in?</h2>
              <p className="text-sm text-muted-foreground">This helps us tailor default settings for your organization.</p>
              <Input
                placeholder="e.g. Construction, Manufacturing, Healthcare..."
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
              />
            </div>
          )}

          {/* Step 2 — Purchase Types */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">What types of items does your business purchase?</h2>
              <p className="text-sm text-muted-foreground">Select all that apply.</p>
              <div className="space-y-3">
                {PURCHASE_TYPES.map((pt) => (
                  <label
                    key={pt.id}
                    className="flex items-center gap-3 rounded-md border px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={purchaseTypes.includes(pt.id)}
                      onCheckedChange={() => togglePurchaseType(pt.id)}
                    />
                    <span className="text-sm font-medium text-foreground">{pt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Step 3 — Approval Thresholds */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Do your purchases require approval?</h2>
              <p className="text-sm text-muted-foreground">If yes, specify the dollar threshold and approver role.</p>
              <div className="flex items-center gap-3">
                <Switch checked={requiresApproval} onCheckedChange={setRequiresApproval} />
                <Label className="text-sm">{requiresApproval ? "Yes, approval required" : "No approval needed"}</Label>
              </div>
              {requiresApproval && (
                <div className="space-y-3 pt-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Threshold Amount ($)</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 500"
                      value={approvalThreshold}
                      onChange={(e) => setApprovalThreshold(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Approver Role</Label>
                    <Select value={approvalRole} onValueChange={setApprovalRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="finance">Finance</SelectItem>
                        <SelectItem value="procurement">Procurement</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4 — Departments */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Do you have multiple departments with separate approvers?</h2>
              <div className="flex items-center gap-3">
                <Switch checked={hasDepartments} onCheckedChange={setHasDepartments} />
                <Label className="text-sm">{hasDepartments ? "Yes" : "No"}</Label>
              </div>
              {hasDepartments && (
                <div className="pt-2">
                  <Label className="text-xs text-muted-foreground">Department names (comma-separated)</Label>
                  <Textarea
                    placeholder="e.g. Operations, Engineering, Sales, HR"
                    value={departmentNames}
                    onChange={(e) => setDepartmentNames(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 5 — Inventory & Sales */}
          {step === 5 && (
            <div className="space-y-5">
              <h2 className="text-xl font-semibold text-foreground">Inventory & Sales</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-foreground mb-2">Do you track inventory for resale or manufacture finished goods?</p>
                  <div className="flex items-center gap-3">
                    <Switch checked={tracksInventory} onCheckedChange={setTracksInventory} />
                    <Label className="text-sm">{tracksInventory ? "Yes" : "No"}</Label>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-foreground mb-2">Do you have a sales team?</p>
                  <div className="flex items-center gap-3">
                    <Switch checked={hasSalesTeam} onCheckedChange={setHasSalesTeam} />
                    <Label className="text-sm">{hasSalesTeam ? "Yes" : "No"}</Label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 6 — Cross-tenant disclosure */}
          {step === 6 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Data Sharing Policy</h2>
              <div className="rounded-md border-2 border-amber-400/60 bg-amber-50/50 dark:bg-amber-950/20 p-5">
                <p className="text-sm leading-relaxed text-foreground">
                  FieldCore uses anonymized patterns from across all organizations to improve AI autofill
                  suggestions. This includes item names, supplier names, average prices, and lead times.
                  Your organization's identity, financial totals, and user data are never shared. You must
                  acknowledge this policy to activate your organization.
                </p>
              </div>
              <label className="flex items-start gap-3 cursor-pointer pt-2">
                <Checkbox
                  checked={policyAccepted}
                  onCheckedChange={(v) => setPolicyAccepted(v === true)}
                  className="mt-0.5"
                />
                <span className="text-sm font-medium text-foreground">
                  I understand and agree to the FieldCore data sharing policy.
                </span>
              </label>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 1}
            >
              Back
            </Button>
            {step < TOTAL_STEPS ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canGoNext()}>
                Next
              </Button>
            ) : (
              <Button onClick={handleFinish} disabled={!canGoNext() || saving}>
                {saving ? "Saving…" : "Finish Setup"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
