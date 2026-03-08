CREATE OR REPLACE FUNCTION public.get_approval_rule(_org_id uuid, _department_id uuid, _total_amount numeric)
 RETURNS TABLE(required_role text, approver_user_id uuid, auto_approve boolean, rule_is_department_scoped boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _matched_rule approval_rules%ROWTYPE;
BEGIN
  -- Treat empty-string UUID as NULL (no department)
  IF _department_id = '00000000-0000-0000-0000-000000000000' THEN
    _department_id := NULL;
  END IF;

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
$function$;