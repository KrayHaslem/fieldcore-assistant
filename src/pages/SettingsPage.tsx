import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/lib/auth";

export default function SettingsPage() {
  const { profile, roles } = useAuth();

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Organization and account configuration"
      />
      <div className="p-8 space-y-6">
        <div className="fieldcore-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Account</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Name</label>
              <p className="text-sm text-foreground">{profile?.full_name ?? "—"}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Email</label>
              <p className="text-sm text-foreground">{profile?.email ?? "—"}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Roles</label>
              <p className="text-sm text-foreground capitalize">{roles.join(", ") || "—"}</p>
            </div>
          </div>
        </div>

        <div className="fieldcore-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-2">Organization Settings</h3>
          <p className="text-sm text-muted-foreground">
            Department management, approval rules, and inventory configuration will be available here.
          </p>
        </div>
      </div>
    </div>
  );
}
