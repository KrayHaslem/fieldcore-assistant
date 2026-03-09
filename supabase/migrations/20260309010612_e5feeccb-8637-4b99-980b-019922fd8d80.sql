-- Create get_sales_by_item RPC
CREATE OR REPLACE FUNCTION public.get_sales_by_item(
  _user_id UUID,
  _start_date TIMESTAMPTZ,
  _end_date TIMESTAMPTZ
)
RETURNS TABLE(
  item_name TEXT,
  units_sold BIGINT,
  revenue NUMERIC
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
      ii.name::TEXT AS item_name,
      SUM(soi.quantity)::BIGINT AS units_sold,
      SUM(soi.quantity * soi.unit_price) AS revenue
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

-- Create get_quarterly_revenue RPC
CREATE OR REPLACE FUNCTION public.get_quarterly_revenue(
  _user_id UUID,
  _start_date TIMESTAMPTZ,
  _end_date TIMESTAMPTZ
)
RETURNS TABLE(
  quarter TEXT,
  total NUMERIC
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
      ('Q' || EXTRACT(QUARTER FROM so.created_at)::TEXT || ' ' || EXTRACT(YEAR FROM so.created_at)::TEXT) AS quarter,
      SUM(so.total_amount) AS total
    FROM sales_orders so
    WHERE so.organization_id = _org_id
      AND so.status IN ('fulfilled', 'invoiced', 'paid', 'closed')
      AND so.created_at >= _start_date
      AND so.created_at <= _end_date
      AND (
        _is_admin = TRUE
        OR _is_finance = TRUE
        OR so.created_by = _user_id
      )
    GROUP BY EXTRACT(QUARTER FROM so.created_at), EXTRACT(YEAR FROM so.created_at)
    ORDER BY EXTRACT(YEAR FROM so.created_at), EXTRACT(QUARTER FROM so.created_at);
END;
$$;

-- Create get_margins_by_timeframe RPC
CREATE OR REPLACE FUNCTION public.get_margins_by_timeframe(
  _user_id UUID,
  _start_date TIMESTAMPTZ,
  _end_date TIMESTAMPTZ,
  _grouping TEXT
)
RETURNS TABLE(
  period TEXT,
  revenue NUMERIC,
  cogs NUMERIC,
  gross_margin NUMERIC,
  margin_pct NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_id UUID;
  _is_admin BOOLEAN;
  _is_finance BOOLEAN;
  _trunc_unit TEXT;
BEGIN
  SELECT organization_id INTO _org_id
    FROM profiles WHERE user_id = _user_id;

  SELECT has_role(_user_id, 'admin') INTO _is_admin;
  SELECT has_role(_user_id, 'finance') INTO _is_finance;

  -- Map grouping to date_trunc unit
  IF _grouping = 'weekly' THEN
    _trunc_unit := 'week';
  ELSIF _grouping = 'quarterly' THEN
    _trunc_unit := 'quarter';
  ELSE
    _trunc_unit := 'month';
  END IF;

  RETURN QUERY
    SELECT
      to_char(date_trunc(_trunc_unit, so.created_at), 
        CASE 
          WHEN _grouping = 'weekly' THEN '"Week of "Mon DD, YYYY'
          WHEN _grouping = 'quarterly' THEN '"Q"Q YYYY'
          ELSE 'Mon YYYY'
        END
      ) AS period,
      SUM(soi.quantity * soi.unit_price) AS revenue,
      SUM(soi.quantity * COALESCE(ii.default_unit_cost, 0)) AS cogs,
      SUM(soi.quantity * soi.unit_price) - SUM(soi.quantity * COALESCE(ii.default_unit_cost, 0)) AS gross_margin,
      CASE 
        WHEN SUM(soi.quantity * soi.unit_price) > 0 
        THEN ((SUM(soi.quantity * soi.unit_price) - SUM(soi.quantity * COALESCE(ii.default_unit_cost, 0))) / SUM(soi.quantity * soi.unit_price)) * 100
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
    GROUP BY date_trunc(_trunc_unit, so.created_at)
    ORDER BY date_trunc(_trunc_unit, so.created_at);
END;
$$;