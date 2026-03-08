CREATE OR REPLACE FUNCTION public.update_user_roles(
  _target_user_id uuid,
  _organization_id uuid,
  _new_roles app_role[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Caller must be admin in the same org
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can manage roles';
  END IF;
  IF get_user_org_id(auth.uid()) != _organization_id THEN
    RAISE EXCEPTION 'Cannot manage roles in another organization';
  END IF;

  -- Delete existing roles for target user in this org
  DELETE FROM public.user_roles
  WHERE user_id = _target_user_id AND organization_id = _organization_id;

  -- Insert new roles
  IF array_length(_new_roles, 1) > 0 THEN
    INSERT INTO public.user_roles (user_id, role, organization_id)
    SELECT _target_user_id, unnest(_new_roles), _organization_id;
  END IF;
END;
$$;