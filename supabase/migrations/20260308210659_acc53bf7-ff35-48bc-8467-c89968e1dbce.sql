
-- 1. Add department assignment to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id);

-- 2. Add approval routing columns to purchase_orders
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS required_approver_role TEXT,
  ADD COLUMN IF NOT EXISTS assigned_approver_id UUID,
  ADD COLUMN IF NOT EXISTS rule_is_department_scoped BOOLEAN DEFAULT false;

-- 3. get_approval_rule RPC
CREATE OR REPLACE FUNCTION public.get_approval_rule(
  _org_id UUID,
  _department_id UUID,
  _total_amount NUMERIC
)
RETURNS TABLE (
  required_role TEXT,
  approver_user_id UUID,
  auto_approve BOOLEAN,
  rule_is_department_scoped BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _matched_rule approval_rules%ROWTYPE;
BEGIN
  SELECT * INTO _matched_rule
  FROM approval_rules ar
  WHERE ar.organization_id = _org_id
    AND (ar.department_id = _department_id OR ar.department_id IS NULL)
    AND ar.min_amount <= _total_amount
    AND (ar.max_amount IS NULL OR ar.max_amount >= _total_amount)
  ORDER BY
    (ar.department_id IS NOT NULL) DESC,
    ar.min_amount DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT ''::TEXT, NULL::UUID, TRUE, FALSE;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    _matched_rule.required_role::TEXT,
    _matched_rule.approver_user_id,
    FALSE,
    (_matched_rule.department_id IS NOT NULL);
END;
$$;

-- 4. get_my_approval_queue RPC
CREATE OR REPLACE FUNCTION public.get_my_approval_queue(_user_id UUID)
RETURNS SETOF public.purchase_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_id UUID;
  _user_dept_id UUID;
  _roles TEXT[];
BEGIN
  SELECT organization_id, department_id INTO _org_id, _user_dept_id
    FROM profiles WHERE user_id = _user_id;

  SELECT array_agg(role::TEXT) INTO _roles
    FROM user_roles WHERE user_id = _user_id;

  RETURN QUERY
    SELECT po.* FROM purchase_orders po
    WHERE po.organization_id = _org_id
      AND po.status = 'submitted'
      AND (
        'admin' = ANY(_roles)
        OR po.assigned_approver_id = _user_id
        OR (
          po.required_approver_role = ANY(_roles)
          AND po.rule_is_department_scoped = true
          AND po.department_id IS NOT NULL
          AND po.department_id = _user_dept_id
        )
        OR (
          po.required_approver_role = ANY(_roles)
          AND po.rule_is_department_scoped = false
        )
      );
END;
$$;
