import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Profile = {
  id: string;
  user_id: string;
  organization_id: string;
  full_name: string;
  email: string;
  department_id: string | null;
  is_active?: boolean;
};

type OrgInfo = {
  is_onboarded: boolean;
  name: string;
};

type UserRole = {
  role: "admin" | "procurement" | "sales" | "finance" | "employee";
};

type OrgOption = { id: string; name: string };

type SubscriptionInfo = {
  subscribed: boolean;
  status?: string;
  trialEnd?: string;
  subscriptionEnd?: string;
  cancelAtPeriodEnd?: boolean;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: string[];
  orgId: string | null;
  orgOnboarded: boolean;
  orgName: string | null;
  organizations: OrgOption[];
  subscription: SubscriptionInfo | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshRoles: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  switchOrg: (orgId: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  roles: [],
  orgId: null,
  orgOnboarded: false,
  orgName: null,
  organizations: [],
  subscription: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
  refreshRoles: async () => {},
  refreshSubscription: async () => {},
  switchOrg: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orgInfo, setOrgInfo] = useState<OrgInfo | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [organizations, setOrganizations] = useState<OrgOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);

  const checkSubscription = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;
      setSubscription({
        subscribed: data?.subscribed ?? false,
        status: data?.status,
        trialEnd: data?.trial_end,
        subscriptionEnd: data?.subscription_end,
        cancelAtPeriodEnd: data?.cancel_at_period_end,
      });
    } catch (e) {
      console.error("check-subscription error:", e);
      setSubscription({ subscribed: false });
    }
  }, []);

  const fetchProfileAndOrg = useCallback(async (userId: string) => {
    // Get all profiles for this user (multi-org)
    const { data: allProfiles } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId);

    if (!allProfiles || allProfiles.length === 0) {
      setProfile(null);
      setOrgInfo(null);
      setOrganizations([]);
      setRoles([]);
      return;
    }

    // Get user preference for active org
    const { data: prefs } = await supabase
      .from("user_preferences")
      .select("active_organization_id")
      .eq("user_id", userId)
      .single();

    const activeOrgId = prefs?.active_organization_id;
    
    // Find the active profile (prefer preference, then first)
    const activeProfile = activeOrgId
      ? allProfiles.find((p: any) => p.organization_id === activeOrgId) || allProfiles[0]
      : allProfiles[0];

    // Check is_active
    if (activeProfile.is_active === false) {
      // User deactivated in this org — sign out
      await supabase.auth.signOut();
      return;
    }

    setProfile(activeProfile);

    // Fetch org info for the active profile
    if (activeProfile.organization_id) {
      const { data: orgData } = await supabase
        .from("organizations")
        .select("is_onboarded, name")
        .eq("id", activeProfile.organization_id)
        .single();
      setOrgInfo(orgData ? { is_onboarded: orgData.is_onboarded, name: orgData.name } : null);
    } else {
      setOrgInfo(null);
    }

    // Build organizations list
    const orgIds = [...new Set(allProfiles.map((p: any) => p.organization_id))];
    if (orgIds.length > 1) {
      const { data: orgsData } = await supabase
        .from("organizations")
        .select("id, name")
        .in("id", orgIds);
      setOrganizations(orgsData ?? []);
    } else if (orgIds.length === 1) {
      const orgName = orgInfo?.name;
      // We already fetched org above, reuse
      setOrganizations([{ id: orgIds[0], name: orgInfo?.name || "Organization" }]);
    } else {
      setOrganizations([]);
    }

    // Fetch roles for active org
    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    setRoles(rolesData?.map((r: UserRole) => r.role) ?? []);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setLoading(true);
          setTimeout(async () => {
            await fetchProfileAndOrg(session.user.id);
            await checkSubscription();
            setLoading(false);
          }, 0);
        } else {
          setProfile(null);
          setOrgInfo(null);
          setRoles([]);
          setOrganizations([]);
          setSubscription(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfileAndOrg, checkSubscription]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshRoles = async () => {
    if (!user) return;
    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    setRoles(rolesData?.map((r: UserRole) => r.role) ?? []);
  };

  const switchOrg = async (newOrgId: string) => {
    if (!user) return;
    setLoading(true);
    // Upsert preference
    await supabase.from("user_preferences").upsert({
      user_id: user.id,
      active_organization_id: newOrgId,
      updated_at: new Date().toISOString(),
    });
    await fetchProfileAndOrg(user.id);
    setLoading(false);
  };

  // Fix: update organizations list after orgInfo is set
  useEffect(() => {
    if (profile && orgInfo) {
      setOrganizations((prev) => {
        const exists = prev.find((o) => o.id === profile.organization_id);
        if (exists && exists.name !== orgInfo.name) {
          return prev.map((o) => o.id === profile.organization_id ? { ...o, name: orgInfo.name } : o);
        }
        if (!exists) {
          return [{ id: profile.organization_id, name: orgInfo.name }];
        }
        return prev;
      });
    }
  }, [profile, orgInfo]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        roles,
        orgId: profile?.organization_id ?? null,
        orgOnboarded: orgInfo?.is_onboarded ?? false,
        orgName: orgInfo?.name ?? null,
        organizations,
        subscription,
        loading,
        signOut,
        refreshProfile: async () => {
          if (!user) return;
          await fetchProfileAndOrg(user.id);
        },
        refreshRoles,
        refreshSubscription: checkSubscription,
        switchOrg,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
