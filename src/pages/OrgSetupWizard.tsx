import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { VoiceInputButton } from "@/components/VoiceInputButton";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Bot, Send, Loader2, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const TOTAL_STEPS = 7; // 0 = AI landing, 1-6 = manual steps

const PURCHASE_TYPES = [
  { id: "resale", label: "Resale" },
  { id: "internal_use", label: "Internal Use" },
  { id: "manufacturing_input", label: "Manufacturing" },
  { id: "consumable", label: "Consumables" },
] as const;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Recommendations {
  suggested_departments?: string[];
  approval_rules?: { min_amount: number; max_amount: number | null; required_role: string }[];
  inventory_types_to_enable?: string[];
  suggested_roles?: string[];
  notes?: string;
}

export default function OrgSetupWizard() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
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

  // AI Quick Setup state
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiPrefilled, setAiPrefilled] = useState(false);

  // Chat assistant state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Recommendations state
  const [recommendations, setRecommendations] = useState<Recommendations | null>(null);

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chatMessages]);

  /** Collect all current answers into an object for the edge function. */
  const collectAnswers = () => ({
    industry,
    purchase_types: purchaseTypes,
    requires_approval: requiresApproval,
    approval_threshold: approvalThreshold,
    approval_role: approvalRole,
    has_departments: hasDepartments,
    department_names: departmentNames,
    tracks_inventory: tracksInventory,
    has_sales_team: hasSalesTeam,
  });

  const applyAiPrefill = (data: Record<string, any>): string => {
    const updated: string[] = [];

    if (data.industry !== undefined) {
      setIndustry(data.industry);
      updated.push("industry");
    }
    if (data.requires_approval !== undefined) {
      setRequiresApproval(data.requires_approval);
      updated.push("approval requirement");
    }
    if (data.approval_threshold !== undefined) {
      setApprovalThreshold(String(data.approval_threshold));
      updated.push(`approval threshold to $${data.approval_threshold}`);
    }
    if (data.approval_role !== undefined) {
      setApprovalRole(data.approval_role);
      updated.push(`approver role to ${data.approval_role}`);
    }
    if (data.has_departments !== undefined) {
      setHasDepartments(data.has_departments);
      updated.push("department setting");
    }
    if (data.department_names !== undefined) {
      const names = Array.isArray(data.department_names)
        ? data.department_names.join(", ")
        : data.department_names;
      setDepartmentNames(names);
      updated.push("department names");
    }
    if (data.tracks_inventory !== undefined) {
      setTracksInventory(data.tracks_inventory);
      updated.push("inventory tracking");
    }
    if (data.has_sales_team !== undefined) {
      setHasSalesTeam(data.has_sales_team);
      updated.push("sales team setting");
    }

    setAiPrefilled(true);

    if (updated.length > 0) {
      return `Updated fields: ${updated.join(", ")}.`;
    }
    return "I couldn't find anything to update from that. Try describing a specific change, like 'change the approval threshold to $2,000'.";
  };

  const handleAnalyze = async () => {
    if (!aiInput.trim() || aiLoading) return;
    setAiLoading(true);
    setAiError("");

    try {
      const userMessages: ChatMessage[] = [{ role: "user", content: aiInput.trim() }];
      const { data, error } = await supabase.functions.invoke("setup-assistant", {
        body: { messages: userMessages, currentStep: 1, answers: collectAnswers() },
      });

      if (error) throw error;

      setChatMessages([]);
      setRecommendations(null);
      setAiPrefilled(false);

      // The reply is conversational; if recommendations exist, show them
      if (data.recommendations) {
        setRecommendations(data.recommendations);
        applyRecommendations(data.recommendations);
      }

      // Add the exchange to chat history
      setChatMessages([
        { role: "user", content: aiInput.trim() },
        { role: "assistant", content: data.reply || "Setup analysis complete." },
      ]);

      setAiPrefilled(true);
      setStep(1); // Jump to step 1 with fields pre-filled
    } catch (err: any) {
      setAiError(err.message || "Failed to analyze. Please try again.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleChatSend = async () => {
    const text = chatInput.trim();
    if (!text || chatSending) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);
    setChatInput("");
    setChatSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("setup-assistant", {
        body: {
          messages: updatedMessages,
          currentStep: step,
          answers: collectAnswers(),
        },
      });

      if (error) throw error;

      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply || "I'm here to help with your setup." },
      ]);

      if (data.recommendations) {
        setRecommendations(data.recommendations);
      }
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Sorry, I couldn't process that: ${err.message}` },
      ]);
    } finally {
      setChatSending(false);
    }
  };

  /** Apply recommendations to wizard fields without finishing setup. */
  const applyRecommendations = (recs: Recommendations) => {
    if (recs.suggested_departments && recs.suggested_departments.length > 0) {
      setHasDepartments(true);
      setDepartmentNames(recs.suggested_departments.join(", "));
    }
    if (recs.approval_rules && recs.approval_rules.length > 0) {
      setRequiresApproval(true);
      const firstRule = recs.approval_rules[0];
      setApprovalThreshold(String(firstRule.min_amount));
      setApprovalRole(firstRule.required_role);
    }
    if (recs.inventory_types_to_enable && recs.inventory_types_to_enable.length > 0) {
      setPurchaseTypes(recs.inventory_types_to_enable);
      const hasResaleOrMfg = recs.inventory_types_to_enable.some(
        (t) => t === "resale" || t === "manufacturing_input"
      );
      if (hasResaleOrMfg) setTracksInventory(true);
    }
    if (recs.suggested_roles) {
      const hasSales = recs.suggested_roles.includes("sales");
      if (hasSales) setHasSalesTeam(true);
    }

    toast({ title: "Recommendations Applied", description: "Fields have been pre-populated. Review each step before finishing." });
  };

  const togglePurchaseType = (id: string) => {
    setPurchaseTypes((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const canGoNext = () => {
    if (step === 0) return true; // skip always allowed
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
      await supabase
        .from("organizations")
        .update({ industry: industry.trim(), is_onboarded: true } as any)
        .eq("id", orgId);

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

  const getStepHeading = (stepNum: number, defaultHeading: string) => {
    if (aiPrefilled && stepNum >= 2 && stepNum <= 5) {
      return `Review: ${defaultHeading}`;
    }
    return defaultHeading;
  };

  const showAssistantPanel = aiPrefilled && step >= 2 && step <= 5;

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">What industry is your business in?</h2>
              <p className="text-sm text-muted-foreground">This helps us tailor default settings for your organization.</p>
              <div className="relative">
                <Input
                  placeholder="e.g. Construction, Manufacturing, Healthcare..."
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="pr-10"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <VoiceInputButton
                    size="sm"
                    onTranscript={(text) => setIndustry(text)}
                  />
                </div>
              </div>
            </div>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or quick setup with AI</span>
              </div>
            </div>

            <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Textarea
                    className="min-h-[100px] resize-none pr-10"
                    placeholder="Describe your organization..."
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                  />
                  <div className="absolute right-2 top-2">
                    <VoiceInputButton
                      size="sm"
                      onTranscript={(text) => setAiInput(text)}
                    />
                  </div>
                </div>
                <Button
                  onClick={handleAnalyze}
                  disabled={aiLoading || !aiInput.trim()}
                  className="shrink-0"
                >
                  {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Analyze"}
                </Button>
              </div>
              {aiError && (
                <p className="text-sm text-destructive">{aiError}</p>
              )}
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-medium">Describe your organization and we'll pre-fill your setup. Try to include:</p>
                <ul className="list-disc list-inside space-y-0.5 ml-2">
                  <li>Your industry (e.g. oilfield equipment manufacturing, construction supply)</li>
                  <li>Whether purchases require approval, and at what dollar amount</li>
                  <li>Whether approvals are handled company-wide or per department</li>
                  <li>Your department names if applicable</li>
                  <li>Whether you manufacture finished goods, buy for resale, or both</li>
                  <li>Whether you have a dedicated sales team</li>
                </ul>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">{getStepHeading(2, "Purchase Types")}</h2>
            <p className="text-sm text-muted-foreground">What types of items does your business purchase? Select all that apply.</p>
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
        );

      case 3:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">{getStepHeading(3, "Approval Requirements")}</h2>
            <p className="text-sm text-muted-foreground">Do your purchases require approval? If yes, specify the dollar threshold and approver role.</p>
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
        );

      case 4:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">{getStepHeading(4, "Departments")}</h2>
            <p className="text-sm text-muted-foreground">Do you have multiple departments with separate approvers?</p>
            <div className="flex items-center gap-3">
              <Switch checked={hasDepartments} onCheckedChange={setHasDepartments} />
              <Label className="text-sm">{hasDepartments ? "Yes" : "No"}</Label>
            </div>
            {hasDepartments && (
              <div className="pt-2">
                <Label className="text-xs text-muted-foreground">Department names (comma-separated)</Label>
                <div className="relative">
                  <Textarea
                    placeholder="e.g. Operations, Engineering, Sales, HR"
                    value={departmentNames}
                    onChange={(e) => setDepartmentNames(e.target.value)}
                    className="pr-10"
                  />
                  <div className="absolute right-2 top-2">
                    <VoiceInputButton
                      size="sm"
                      onTranscript={(text) => setDepartmentNames(text)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 5:
        return (
          <div className="space-y-5">
            <h2 className="text-xl font-semibold text-foreground">{getStepHeading(5, "Inventory & Sales")}</h2>
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
        );

      case 6:
        return (
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
        );

      default:
        return null;
    }
  };

  const renderRecommendationsCard = () => {
    if (!recommendations) return null;

    return (
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3 text-xs">
          {recommendations.suggested_departments && recommendations.suggested_departments.length > 0 && (
            <div>
              <p className="font-medium text-muted-foreground mb-1">Departments</p>
              <div className="flex flex-wrap gap-1">
                {recommendations.suggested_departments.map((d) => (
                  <Badge key={d} variant="secondary" className="text-xs">{d}</Badge>
                ))}
              </div>
            </div>
          )}

          {recommendations.approval_rules && recommendations.approval_rules.length > 0 && (
            <div>
              <p className="font-medium text-muted-foreground mb-1">Approval Rules</p>
              {recommendations.approval_rules.map((rule, i) => (
                <p key={i} className="text-foreground">
                  ${rule.min_amount.toLocaleString()}
                  {rule.max_amount ? `–$${rule.max_amount.toLocaleString()}` : "+"} → {rule.required_role}
                </p>
              ))}
            </div>
          )}

          {recommendations.inventory_types_to_enable && recommendations.inventory_types_to_enable.length > 0 && (
            <div>
              <p className="font-medium text-muted-foreground mb-1">Inventory Types</p>
              <div className="flex flex-wrap gap-1">
                {recommendations.inventory_types_to_enable.map((t) => (
                  <Badge key={t} variant="outline" className="text-xs">{t.replace(/_/g, " ")}</Badge>
                ))}
              </div>
            </div>
          )}

          {recommendations.suggested_roles && recommendations.suggested_roles.length > 0 && (
            <div>
              <p className="font-medium text-muted-foreground mb-1">Suggested Roles</p>
              <div className="flex flex-wrap gap-1">
                {recommendations.suggested_roles.map((r) => (
                  <Badge key={r} variant="outline" className="text-xs">{r}</Badge>
                ))}
              </div>
            </div>
          )}

          {recommendations.notes && (
            <p className="text-muted-foreground italic">{recommendations.notes}</p>
          )}

          <Button
            size="sm"
            variant="outline"
            className="w-full mt-2"
            onClick={() => applyRecommendations(recommendations)}
          >
            <Sparkles className="h-3 w-3 mr-1" />
            Apply Recommendations
          </Button>
        </CardContent>
      </Card>
    );
  };

  const renderAssistantPanel = () => (
    <div className="w-72 shrink-0 flex flex-col gap-3">
      {/* Chat panel */}
      <div className="border rounded-lg bg-card flex flex-col h-[320px]">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Bot className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Assistant</span>
        </div>

        <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
          {chatMessages.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Ask me about your setup, e.g. "what approval threshold should I use?"
            </p>
          )}
          {chatMessages.map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && <Bot className="h-4 w-4 mt-1 text-primary shrink-0" />}
              <div
                className={`rounded-lg px-3 py-2 text-sm max-w-[85%] ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {chatSending && (
            <div className="flex gap-2">
              <Bot className="h-4 w-4 mt-1 text-primary shrink-0" />
              <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">Thinking...</div>
            </div>
          )}
        </div>

        <div className="border-t p-3">
          <form
            onSubmit={(e) => { e.preventDefault(); handleChatSend(); }}
            className="flex gap-2"
          >
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask about setup..."
              className="text-sm"
              disabled={chatSending}
            />
            <Button type="submit" size="icon" disabled={chatSending || !chatInput.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>

      {/* Recommendations card */}
      {renderRecommendationsCard()}
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className={`w-full ${showAssistantPanel ? "max-w-4xl" : "max-w-xl"}`}>
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

        <div className="fieldcore-card p-8">
          <div className={`${showAssistantPanel ? "flex gap-6" : ""}`}>
            {/* Step content */}
            <div className={`space-y-6 ${showAssistantPanel ? "flex-1" : ""}`}>
              {renderStepContent()}

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

            {/* Assistant panel */}
            {showAssistantPanel && renderAssistantPanel()}
          </div>
        </div>
      </div>
    </div>
  );
}
