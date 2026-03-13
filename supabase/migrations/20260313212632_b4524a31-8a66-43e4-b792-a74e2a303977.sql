
-- Fix: cascade org deletion to user_preferences
ALTER TABLE public.user_preferences
  DROP CONSTRAINT user_preferences_active_organization_id_fkey,
  ADD CONSTRAINT user_preferences_active_organization_id_fkey
    FOREIGN KEY (active_organization_id)
    REFERENCES public.organizations(id)
    ON DELETE SET NULL;

-- Add DELETE policy on profiles for superadmins
CREATE POLICY "Superadmins delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'superadmin'::app_role));

-- Add DELETE policy on user_roles for superadmins (cross-org)
CREATE POLICY "Superadmins delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'superadmin'::app_role));
