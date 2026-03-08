CREATE OR REPLACE FUNCTION public.get_sales_by_salesperson(
  _user_id UUID,
  _start_date TIMESTAMPTZ,
  _end_date TIMESTAMPTZ
)
RETURNS TABLE (
  salesperson_name TEXT,
  order_count BIGINT,
  total_revenue NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_id UUID;
  _is_admin BOOLEAN;
  _is_finance BOOLEAN;
BEGIN
  SELECT organization_id INTO _org_id
    FROM profiles WHERE user_id = _user_id;

  SELECT has_role(_user_id, 'admin') INTO _is_admin;
  SELECT has_role(_user_id, 'finance') INTO _is_finance;

  RETURN QUERY
    SELECT
      p.full_name::TEXT,
      COUNT(so.id),
      SUM(so.total_amount)
    FROM sales_orders so
    JOIN profiles p ON p.user_id = so.created_by
    WHERE so.organization_id = _org_id
      AND so.status IN ('fulfilled','invoiced','paid','closed')
      AND so.created_at >= _start_date
      AND so.created_at <= _end_date
      AND (
        _is_admin = TRUE
        OR _is_finance = TRUE
        OR so.created_by = _user_id
      )
    GROUP BY p.full_name
    ORDER BY SUM(so.total_amount) DESC;
END;
$$;