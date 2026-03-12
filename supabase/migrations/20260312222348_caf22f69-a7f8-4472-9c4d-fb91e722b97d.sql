-- Allow authenticated users without an existing profile to create an organization
CREATE POLICY "New users can create org"
  ON public.organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid())
  );

-- Allow org members to update their own org (for onboarding setup wizard)
CREATE POLICY "Org members can update own org"
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (id = get_user_org_id(auth.uid()));

-- Allow new users to self-assign initial role during onboarding
CREATE POLICY "New users can self-assign initial role"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role != 'superadmin'
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
  );