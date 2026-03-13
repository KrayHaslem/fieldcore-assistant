import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Get the calling user's JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create client with user's JWT to check permissions
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, email, roles, organization_id, token, origin } = await req.json();

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // ---- ACCEPT INVITATION ----
    if (action === "accept") {
      if (!token) {
        return new Response(JSON.stringify({ error: "Token required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find invitation
      const { data: invitation, error: invErr } = await adminClient
        .from("invitations")
        .select("*")
        .eq("token", token)
        .is("accepted_at", null)
        .single();

      if (invErr || !invitation) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired invitation" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (new Date(invitation.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: "Invitation has expired" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Check if profile already exists for this user + org
      const { data: existingProfile } = await adminClient
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .eq("organization_id", invitation.organization_id)
        .single();

      if (!existingProfile) {
        // Create profile
        const { error: profileErr } = await adminClient.from("profiles").insert({
          user_id: user.id,
          organization_id: invitation.organization_id,
          full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
          email: user.email!,
        });
        if (profileErr) {
          return new Response(
            JSON.stringify({ error: "Failed to create profile: " + profileErr.message }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }

      // Assign roles
      const invRoles = invitation.roles || ["employee"];
      for (const role of invRoles) {
        // Check if role already exists
        const { data: existingRole } = await adminClient
          .from("user_roles")
          .select("id")
          .eq("user_id", user.id)
          .eq("organization_id", invitation.organization_id)
          .eq("role", role)
          .single();

        if (!existingRole) {
          await adminClient.from("user_roles").insert({
            user_id: user.id,
            organization_id: invitation.organization_id,
            role,
          });
        }
      }

      // Set active org to the invited org
      await adminClient.from("user_preferences").upsert({
        user_id: user.id,
        active_organization_id: invitation.organization_id,
        updated_at: new Date().toISOString(),
      });

      // Mark invitation as accepted
      await adminClient
        .from("invitations")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", invitation.id);

      return new Response(
        JSON.stringify({ success: true, organization_id: invitation.organization_id }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ---- SEND INVITATION ----
    if (!email || !organization_id) {
      return new Response(
        JSON.stringify({ error: "Email and organization_id required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify caller is admin in the org
    const { data: callerHasRole } = await adminClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!callerHasRole) {
      return new Response(JSON.stringify({ error: "Only admins can invite users" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check org matches
    const { data: callerOrgId } = await adminClient.rpc("get_user_org_id", {
      _user_id: user.id,
    });
    if (callerOrgId !== organization_id) {
      return new Response(
        JSON.stringify({ error: "Cannot invite to a different organization" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check for existing pending invitation
    const { data: existing } = await adminClient
      .from("invitations")
      .select("id")
      .eq("organization_id", organization_id)
      .eq("email", email.toLowerCase())
      .is("accepted_at", null)
      .gte("expires_at", new Date().toISOString())
      .single();

    if (existing) {
      return new Response(
        JSON.stringify({ error: "A pending invitation already exists for this email" }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Generate token
    const tokenValue = crypto.randomUUID() + "-" + crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { error: insertErr } = await adminClient.from("invitations").insert({
      organization_id,
      email: email.toLowerCase(),
      invited_by: user.id,
      token: tokenValue,
      roles: roles || ["employee"],
      expires_at: expiresAt.toISOString(),
    });

    if (insertErr) {
      return new Response(
        JSON.stringify({ error: "Failed to create invitation: " + insertErr.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const inviteLink = `${origin || "https://fieldcore.app"}/auth?invite=${tokenValue}`;

    return new Response(
      JSON.stringify({
        success: true,
        invite_link: inviteLink,
        expires_at: expiresAt.toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
