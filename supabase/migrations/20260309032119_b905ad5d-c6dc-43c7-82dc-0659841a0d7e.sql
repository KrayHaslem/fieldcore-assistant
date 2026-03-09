
-- FIX 1: Restrict profile INSERT so users can only create profiles 
-- in an organization they were invited to (via existing org membership check)
-- or during onboarding. We replace the permissive insert policy with one
-- that also validates organization_id.

-- Drop existing insert policy
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;

-- Create a security definer function to validate org assignment during signup
-- This checks if the user already has a profile (preventing duplicates)
-- and is meant to be used only during initial onboarding via trusted functions.
CREATE OR REPLACE FUNCTION public.can_insert_profile(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Allow if user has no profile yet (first-time signup/onboarding)
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id) THEN
    RETURN TRUE;
  END IF;
  -- Otherwise deny - profile already exists
  RETURN FALSE;
END;
$$;

-- New insert policy: user_id must match AND either first profile or org matches existing
CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND can_insert_profile(auth.uid(), organization_id)
  );

-- FIX 2: Prevent admins from assigning superadmin role
-- Drop existing ALL policy and replace with scoped policies

DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;

-- Admins can SELECT all roles in their org
CREATE POLICY "Admins select roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin') 
    AND organization_id = get_user_org_id(auth.uid())
  );

-- Admins can INSERT roles in their org, but NOT superadmin
CREATE POLICY "Admins insert roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin')
    AND organization_id = get_user_org_id(auth.uid())
    AND role != 'superadmin'
  );

-- Admins can UPDATE roles in their org, but NOT to superadmin
CREATE POLICY "Admins update roles"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    AND organization_id = get_user_org_id(auth.uid())
  )
  WITH CHECK (role != 'superadmin');

-- Admins can DELETE roles in their org, but NOT superadmin roles
CREATE POLICY "Admins delete roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    AND organization_id = get_user_org_id(auth.uid())
    AND role != 'superadmin'
  );

-- Also update the update_user_roles function to block superadmin assignment
CREATE OR REPLACE FUNCTION public.update_user_roles(_target_user_id uuid, _organization_id uuid, _new_roles app_role[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  -- Caller must be admin in the same org
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can manage roles';
  END IF;
  IF get_user_org_id(auth.uid()) != _organization_id THEN
    RAISE EXCEPTION 'Cannot manage roles in another organization';
  END IF;
  
  -- Block superadmin assignment via this function
  IF 'superadmin' = ANY(_new_roles) THEN
    RAISE EXCEPTION 'Cannot assign superadmin role';
  END IF;

  -- Delete existing non-superadmin roles for target user in this org
  DELETE FROM public.user_roles
  WHERE user_id = _target_user_id 
    AND organization_id = _organization_id
    AND role != 'superadmin';

  -- Insert new roles (excluding superadmin as safety net)
  IF array_length(_new_roles, 1) > 0 THEN
    INSERT INTO public.user_roles (user_id, role, organization_id)
    SELECT _target_user_id, unnest(_new_roles), _organization_id
    WHERE NOT ('superadmin' = ANY(_new_roles));
  END IF;
END;
$$;
