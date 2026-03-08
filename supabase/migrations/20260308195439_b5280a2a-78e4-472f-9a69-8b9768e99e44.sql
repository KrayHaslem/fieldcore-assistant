
-- Allow superadmins to SELECT all organizations
CREATE POLICY "Superadmins can view all orgs"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'));

-- Allow superadmins to INSERT organizations
CREATE POLICY "Superadmins can insert orgs"
  ON public.organizations FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- Allow superadmins to UPDATE organizations
CREATE POLICY "Superadmins can update orgs"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'));

-- Allow superadmins to DELETE organizations
CREATE POLICY "Superadmins can delete orgs"
  ON public.organizations FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'));
