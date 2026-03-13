
-- 1a. Add is_active to profiles
ALTER TABLE public.profiles ADD COLUMN is_active boolean NOT NULL DEFAULT true;

-- 1b. Create invitations table
CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_by uuid NOT NULL,
  token text UNIQUE NOT NULL,
  roles text[] NOT NULL DEFAULT '{employee}',
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Admins in org can manage invitations
CREATE POLICY "Admins manage invitations" ON public.invitations
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') AND organization_id = get_user_org_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin') AND organization_id = get_user_org_id(auth.uid()));

-- Anyone can select by token (for acceptance validation)
CREATE POLICY "Select invitation by token" ON public.invitations
  FOR SELECT TO anon, authenticated
  USING (true);

-- 1c. Add unique constraint for multi-org profiles
ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_organization_id_key UNIQUE (user_id, organization_id);

-- Update can_insert_profile to allow multiple orgs
CREATE OR REPLACE FUNCTION public.can_insert_profile(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow if user has no profile in this specific org
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id AND organization_id = _org_id) THEN
    RETURN TRUE;
  END IF;
  RETURN FALSE;
END;
$$;

-- 1d. Create user_preferences table
CREATE TABLE public.user_preferences (
  user_id uuid PRIMARY KEY,
  active_organization_id uuid REFERENCES public.organizations(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own preferences" ON public.user_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Update get_user_org_id to check user_preferences first
CREATE OR REPLACE FUNCTION public.get_user_org_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT active_organization_id FROM public.user_preferences WHERE user_id = _user_id),
    (SELECT organization_id FROM public.profiles WHERE user_id = _user_id LIMIT 1)
  )
$$;
