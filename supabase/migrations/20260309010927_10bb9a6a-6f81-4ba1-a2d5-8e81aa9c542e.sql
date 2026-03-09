-- Add cost_per_unit column to sales_order_items
ALTER TABLE public.sales_order_items 
ADD COLUMN IF NOT EXISTS cost_per_unit NUMERIC NOT NULL DEFAULT 0;

-- Backfill existing rows with default_unit_cost from inventory_items
UPDATE public.sales_order_items soi
SET cost_per_unit = COALESCE(ii.default_unit_cost, 0)
FROM public.inventory_items ii
WHERE soi.item_id = ii.id
  AND soi.cost_per_unit = 0;

-- Update get_margins_by_timeframe RPC to use cost_per_unit
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
      SUM(soi.quantity * soi.cost_per_unit) AS cogs,
      SUM(soi.quantity * soi.unit_price) - SUM(soi.quantity * soi.cost_per_unit) AS gross_margin,
      CASE 
        WHEN SUM(soi.quantity * soi.unit_price) > 0 
        THEN ((SUM(soi.quantity * soi.unit_price) - SUM(soi.quantity * soi.cost_per_unit)) / SUM(soi.quantity * soi.unit_price)) * 100
        ELSE 0
      END AS margin_pct
    FROM sales_order_items soi
    JOIN sales_orders so ON so.id = soi.sales_order_id
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