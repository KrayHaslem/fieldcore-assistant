
CREATE OR REPLACE FUNCTION public.get_margin_by_item(_user_id uuid, _start_date timestamp with time zone, _end_date timestamp with time zone)
 RETURNS TABLE(item_name text, units_sold bigint, revenue numeric, cogs numeric, gross_margin numeric, margin_pct numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
      ii.name::TEXT AS item_name,
      SUM(soi.quantity)::BIGINT AS units_sold,
      SUM(soi.quantity * soi.unit_price) AS revenue,
      SUM(soi.quantity * soi.cost_per_unit) AS cogs,
      SUM(soi.quantity * soi.unit_price) - SUM(soi.quantity * soi.cost_per_unit) AS gross_margin,
      CASE
        WHEN SUM(soi.quantity * soi.unit_price) > 0
        THEN ((SUM(soi.quantity * soi.unit_price) - SUM(soi.quantity * soi.cost_per_unit)) / SUM(soi.quantity * soi.unit_price)) * 100
        ELSE 0
      END AS margin_pct
    FROM sales_order_items soi
    JOIN sales_orders so ON so.id = soi.sales_order_id
    JOIN inventory_items ii ON ii.id = soi.item_id
    WHERE so.organization_id = _org_id
      AND so.status IN ('fulfilled', 'invoiced', 'paid', 'closed')
      AND so.created_at >= _start_date
      AND so.created_at <= _end_date
      AND (
        _is_admin = TRUE
        OR _is_finance = TRUE
        OR so.created_by = _user_id
      )
    GROUP BY ii.name
    ORDER BY SUM(soi.quantity * soi.unit_price) DESC;
END;
$$;
