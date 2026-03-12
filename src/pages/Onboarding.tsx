import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppLogo } from "@/components/AppLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Onboarding() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState("");
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);

  // Pre-fill name from Google metadata
  useEffect(() => {
    if (user?.user_metadata?.full_name) {
      setFullName(user.user_metadata.full_name);
    }
  }, [user]);

  // If user already has a profile, redirect to dashboard
  useEffect(() => {
    if (!authLoading && profile) {
      navigate("/", { replace: true });
    }
  }, [authLoading, profile, navigate]);

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !orgName.trim() || !fullName.trim()) return;
    setSaving(true);

    try {
      // 1. Create organization
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .insert({ name: orgName.trim() })
        .select("id")
        .single();

      if (orgError) throw orgError;

      // 2. Create profile
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          user_id: user.id,
          organization_id: org.id,
          full_name: fullName.trim(),
          email: user.email!,
        });

      if (profileError) throw profileError;

      // 3. Assign admin role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: user.id,
          organization_id: org.id,
          role: "admin" as any,
        });

      if (roleError) throw roleError;

      toast.success("Organization created! Let's configure your settings.");
      // Navigate to the setup wizard
      navigate(`/setup/${org.id}`, { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Failed to create organization");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        <div className="text-center">
          <div className="mx-auto flex justify-center">
            <AppLogo size="lg" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
            Welcome to FieldCore
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Let's set up your organization to get started.
          </p>
        </div>

        <form onSubmit={handleCreateOrg} className="fieldcore-card p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Your Name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Smith"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="orgName">Organization Name</Label>
            <Input
              id="orgName"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Acme Corp"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Organization"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
