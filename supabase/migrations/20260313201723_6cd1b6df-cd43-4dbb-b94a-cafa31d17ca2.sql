
CREATE POLICY "Admins update org profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND organization_id = get_user_org_id(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND organization_id = get_user_org_id(auth.uid())
);
