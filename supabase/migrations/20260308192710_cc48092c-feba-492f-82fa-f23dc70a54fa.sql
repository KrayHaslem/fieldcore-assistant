
-- Create Platform Administration organization
INSERT INTO public.organizations (id, name, industry)
VALUES ('00000000-0000-0000-0000-000000000000', 'Platform Administration', 'Platform Management')
ON CONFLICT (id) DO NOTHING;

-- Create profile for Kray Haslem
INSERT INTO public.profiles (user_id, organization_id, full_name, email)
VALUES ('1fe1f22f-40cf-4706-88c6-b02290585b36', '00000000-0000-0000-0000-000000000000', 'Kray Haslem', 'k.haslem@icloud.com')
ON CONFLICT DO NOTHING;

-- Create superadmin role
INSERT INTO public.user_roles (user_id, organization_id, role)
VALUES ('1fe1f22f-40cf-4706-88c6-b02290585b36', '00000000-0000-0000-0000-000000000000', 'superadmin')
ON CONFLICT DO NOTHING;

-- Security definer function to list all tenant orgs (excludes platform admin org)
CREATE OR REPLACE FUNCTION public.list_all_organizations()
RETURNS TABLE(id uuid, name text, industry text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.name, o.industry, o.created_at
  FROM public.organizations o
  WHERE o.id != '00000000-0000-0000-0000-000000000000'
  ORDER BY o.name;
$$;
