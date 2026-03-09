
CREATE OR REPLACE FUNCTION public.get_low_stock_items(_org_id UUID)
RETURNS TABLE(id UUID, name TEXT, sku TEXT, reorder_point INTEGER, current_stock BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ii.id,
    ii.name,
    ii.sku,
    ii.reorder_point,
    COALESCE(SUM(im.quantity), 0)::BIGINT AS current_stock
  FROM inventory_items ii
  LEFT JOIN inventory_movements im ON im.item_id = ii.id
  WHERE ii.organization_id = _org_id
    AND ii.reorder_point IS NOT NULL
    AND ii.item_type IN ('resale', 'manufacturing_input')
  GROUP BY ii.id, ii.name, ii.sku, ii.reorder_point
  HAVING COALESCE(SUM(im.quantity), 0) <= ii.reorder_point;
$$;
