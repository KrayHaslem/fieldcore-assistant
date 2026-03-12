
CREATE OR REPLACE FUNCTION public.create_onboarding_org(_user_id uuid, _org_name text, _full_name text, _email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_id uuid;
BEGIN
  -- Ensure user doesn't already have a profile
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id) THEN
    RAISE EXCEPTION 'User already has a profile';
  END IF;

  -- Create organization
  INSERT INTO public.organizations (name)
  VALUES (_org_name)
  RETURNING id INTO _org_id;

  -- Create profile
  INSERT INTO public.profiles (user_id, organization_id, full_name, email)
  VALUES (_user_id, _org_id, _full_name, _email);

  -- Assign admin role
  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (_user_id, _org_id, 'admin');

  RETURN _org_id;
END;
$$;
