import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Profile = {
  id: string;
  user_id: string;
  organization_id: string;
  full_name: string;
  email: string;
  department_id: string | null;
};

type OrgInfo = {
  is_onboarded: boolean;
};

type UserRole = {
  role: "admin" | "procurement" | "sales" | "finance" | "employee";
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: string[];
  orgId: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshRoles: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  roles: [],
  orgId: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
  refreshRoles: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Defer profile fetch to avoid deadlock
          setTimeout(async () => {
            const { data: profileData } = await supabase
              .from("profiles")
              .select("*")
              .eq("user_id", session.user.id)
              .single();
            setProfile(profileData);

            const { data: rolesData } = await supabase
              .from("user_roles")
              .select("role")
              .eq("user_id", session.user.id);
            setRoles(rolesData?.map((r: UserRole) => r.role) ?? []);
            setLoading(false);
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (!user) return;
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();
    setProfile(profileData);
  };

  const refreshRoles = async () => {
    if (!user) return;
    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    setRoles(rolesData?.map((r: UserRole) => r.role) ?? []);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        roles,
        orgId: profile?.organization_id ?? null,
        loading,
        signOut,
        refreshProfile,
        refreshRoles,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
