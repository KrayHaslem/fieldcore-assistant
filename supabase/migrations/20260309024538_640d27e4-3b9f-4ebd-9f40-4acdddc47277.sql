
UPDATE public.report_templates SET sql_query = 'SELECT s.name, SUM(po.total_amount) AS total_spend
FROM purchase_orders po
JOIN suppliers s ON s.id = po.supplier_id
WHERE po.organization_id = :org_id
  AND po.status != ''draft''
  AND po.created_at >= :start_date
  AND po.created_at <= :end_date
GROUP BY s.name
ORDER BY total_spend DESC'
WHERE name = 'Spending by Supplier' AND organization_id IS NULL;

UPDATE public.report_templates SET sql_query = 'SELECT po.po_number, po.status, po.total_amount, po.created_at,
  s.name AS supplier_name, d.name AS department_name
FROM purchase_orders po
LEFT JOIN suppliers s ON s.id = po.supplier_id
LEFT JOIN departments d ON d.id = po.department_id
WHERE po.organization_id = :org_id
  AND po.status NOT IN (''closed'', ''draft'')
ORDER BY po.status, po.created_at DESC'
WHERE name = 'Open Purchase Orders' AND organization_id IS NULL;

UPDATE public.report_templates SET sql_query = 'SELECT po.po_number, po.total_amount, po.created_at,
  s.name AS supplier_name, d.name AS department_name,
  EXTRACT(DAY FROM now() - po.created_at)::INT AS days_pending
FROM purchase_orders po
LEFT JOIN suppliers s ON s.id = po.supplier_id
LEFT JOIN departments d ON d.id = po.department_id
WHERE po.organization_id = :org_id
  AND po.status = ''submitted''
ORDER BY po.created_at'
WHERE name = 'Pending Approvals' AND organization_id IS NULL;

UPDATE public.report_templates SET sql_query = 'SELECT to_char(po.created_at, ''Mon YYYY'') AS month,
  SUM(po.total_amount) AS total
FROM purchase_orders po
WHERE po.organization_id = :org_id
  AND po.status != ''draft''
  AND po.created_at >= :start_date
  AND po.created_at <= :end_date
GROUP BY to_char(po.created_at, ''Mon YYYY''), date_trunc(''month'', po.created_at)
ORDER BY date_trunc(''month'', po.created_at)'
WHERE name = 'Monthly Purchase Totals' AND organization_id IS NULL;

UPDATE public.report_templates SET sql_query = 'SELECT ''Q'' || EXTRACT(QUARTER FROM po.created_at)::TEXT || '' '' || EXTRACT(YEAR FROM po.created_at)::TEXT AS quarter,
  SUM(po.total_amount) AS total
FROM purchase_orders po
WHERE po.organization_id = :org_id
  AND po.status != ''draft''
  AND po.created_at >= :start_date
  AND po.created_at <= :end_date
GROUP BY EXTRACT(QUARTER FROM po.created_at), EXTRACT(YEAR FROM po.created_at)
ORDER BY EXTRACT(YEAR FROM po.created_at), EXTRACT(QUARTER FROM po.created_at)'
WHERE name = 'Quarterly Spending' AND organization_id IS NULL;

UPDATE public.report_templates SET sql_query = 'SELECT ii.name AS item_name, ii.sku,
  poi.quantity, poi.unit_cost,
  po.po_number, po.created_at, po.status,
  s.name AS supplier_name
FROM purchase_order_items poi
JOIN purchase_orders po ON po.id = poi.purchase_order_id
JOIN inventory_items ii ON ii.id = poi.item_id
LEFT JOIN suppliers s ON s.id = po.supplier_id
WHERE po.organization_id = :org_id
  AND po.status != ''draft''
  AND po.created_at >= :start_date
  AND po.created_at <= :end_date
ORDER BY ii.name, po.created_at DESC'
WHERE name = 'Purchase History by Item' AND organization_id IS NULL;

UPDATE public.report_templates SET sql_query = 'SELECT ii.name, ii.sku, ii.item_type,
  COALESCE(SUM(im.quantity), 0) AS on_hand,
  ii.default_unit_cost AS unit_cost,
  COALESCE(SUM(im.quantity), 0) * COALESCE(ii.default_unit_cost, 0) AS total_value
FROM inventory_items ii
LEFT JOIN inventory_movements im ON im.item_id = ii.id
WHERE ii.organization_id = :org_id
GROUP BY ii.id, ii.name, ii.sku, ii.item_type, ii.default_unit_cost
ORDER BY ii.item_type, ii.name'
WHERE name = 'Inventory Valuation' AND organization_id IS NULL;

UPDATE public.report_templates SET sql_query = 'SELECT r.created_at, ii.name AS item_name,
  r.expected_quantity, r.actual_quantity, r.variance, r.notes
FROM reconciliations r
JOIN inventory_items ii ON ii.id = r.item_id
WHERE r.organization_id = :org_id
  AND r.created_at >= :start_date
  AND r.created_at <= :end_date
ORDER BY r.created_at DESC'
WHERE name = 'Reconciliation History' AND organization_id IS NULL;

UPDATE public.report_templates SET sql_query = 'SELECT ii.name AS item_name,
  im.movement_type, im.quantity, im.created_at
FROM inventory_movements im
JOIN inventory_items ii ON ii.id = im.item_id
WHERE im.organization_id = :org_id
  AND ii.item_type IN (''resale'', ''manufacturing_input'')
  AND im.created_at >= :start_date
  AND im.created_at <= :end_date
ORDER BY ii.name, im.created_at'
WHERE name = 'Inventory Performance by Item' AND organization_id IS NULL;

UPDATE public.report_templates SET sql_query = 'SELECT ii.name, ii.sku,
  COALESCE(SUM(im.quantity), 0) AS current_stock,
  ii.reorder_point,
  s.name AS supplier_name,
  s.avg_lead_time_days
FROM inventory_items ii
LEFT JOIN inventory_movements im ON im.item_id = ii.id
LEFT JOIN suppliers s ON s.id = ii.preferred_supplier_id
WHERE ii.organization_id = :org_id
  AND ii.item_type IN (''resale'', ''manufacturing_input'')
  AND ii.reorder_point IS NOT NULL
GROUP BY ii.id, ii.name, ii.sku, ii.reorder_point, s.name, s.avg_lead_time_days
HAVING COALESCE(SUM(im.quantity), 0) <= ii.reorder_point
ORDER BY ii.name'
WHERE name = 'Recommended Stock Levels' AND organization_id IS NULL;

UPDATE public.report_templates SET sql_query = 'SELECT ii.name AS item_name,
  SUM(ABS(r.variance)) AS total_units_lost,
  SUM(ABS(r.variance) * COALESCE(ii.default_unit_cost, 0)) AS estimated_value_lost
FROM reconciliations r
JOIN inventory_items ii ON ii.id = r.item_id
WHERE r.organization_id = :org_id
  AND r.variance < 0
  AND r.created_at >= :start_date
  AND r.created_at <= :end_date
GROUP BY ii.name, ii.default_unit_cost
ORDER BY estimated_value_lost DESC'
WHERE name = 'Inventory Loss Summary' AND organization_id IS NULL;

UPDATE public.report_templates SET sql_query = 'SELECT ar.created_at, ii.name AS finished_item,
  ar.quantity_produced, ar.notes
FROM assembly_records ar
JOIN inventory_items ii ON ii.id = ar.finished_item_id
WHERE ar.organization_id = :org_id
  AND ar.created_at >= :start_date
  AND ar.created_at <= :end_date
ORDER BY ar.created_at DESC'
WHERE name = 'Assembly History' AND organization_id IS NULL;

UPDATE public.report_templates SET sql_query = 'SELECT ii.name AS item_name,
  SUM(soi.quantity)::BIGINT AS units_sold,
  SUM(soi.quantity * soi.unit_price) AS revenue
FROM sales_order_items soi
JOIN sales_orders so ON so.id = soi.sales_order_id
JOIN inventory_items ii ON ii.id = soi.item_id
WHERE so.organization_id = :org_id
  AND so.status IN (''fulfilled'', ''invoiced'', ''paid'', ''closed'')
  AND so.created_at >= :start_date
  AND so.created_at <= :end_date
GROUP BY ii.name
ORDER BY revenue DESC'
WHERE name = 'Sales by Item' AND organization_id IS NULL;

UPDATE public.report_templates SET sql_query = 'SELECT ii.name AS item_name,
  SUM(soi.quantity)::BIGINT AS units_sold,
  SUM(soi.quantity * soi.unit_price) AS revenue,
  SUM(soi.quantity * soi.cost_per_unit) AS cogs,
  SUM(soi.quantity * soi.unit_price) - SUM(soi.quantity * soi.cost_per_unit) AS gross_margin,
  CASE WHEN SUM(soi.quantity * soi.unit_price) > 0
    THEN ((SUM(soi.quantity * soi.unit_price) - SUM(soi.quantity * soi.cost_per_unit)) / SUM(soi.quantity * soi.unit_price)) * 100
    ELSE 0 END AS margin_pct
FROM sales_order_items soi
JOIN sales_orders so ON so.id = soi.sales_order_id
JOIN inventory_items ii ON ii.id = soi.item_id
WHERE so.organization_id = :org_id
  AND so.status IN (''fulfilled'', ''invoiced'', ''paid'', ''closed'')
  AND so.created_at >= :start_date
  AND so.created_at <= :end_date
GROUP BY ii.name
ORDER BY revenue DESC'
WHERE name = 'Margin by Item' AND organization_id IS NULL;

UPDATE public.report_templates SET sql_query = 'SELECT ''Q'' || EXTRACT(QUARTER FROM so.created_at)::TEXT || '' '' || EXTRACT(YEAR FROM so.created_at)::TEXT AS quarter,
  SUM(so.total_amount) AS total
FROM sales_orders so
WHERE so.organization_id = :org_id
  AND so.status IN (''fulfilled'', ''invoiced'', ''paid'', ''closed'')
  AND so.created_at >= :start_date
  AND so.created_at <= :end_date
GROUP BY EXTRACT(QUARTER FROM so.created_at), EXTRACT(YEAR FROM so.created_at)
ORDER BY EXTRACT(YEAR FROM so.created_at), EXTRACT(QUARTER FROM so.created_at)'
WHERE name = 'Quarterly Revenue' AND organization_id IS NULL;

UPDATE public.report_templates SET sql_query = 'SELECT p.full_name AS salesperson_name,
  COUNT(so.id)::BIGINT AS order_count,
  SUM(so.total_amount) AS total_revenue
FROM sales_orders so
JOIN profiles p ON p.user_id = so.created_by
WHERE so.organization_id = :org_id
  AND so.status IN (''fulfilled'', ''invoiced'', ''paid'', ''closed'')
  AND so.created_at >= :start_date
  AND so.created_at <= :end_date
GROUP BY p.full_name
ORDER BY total_revenue DESC'
WHERE name = 'Sales by Salesperson' AND organization_id IS NULL;

UPDATE public.report_templates SET sql_query = 'SELECT to_char(date_trunc(''month'', so.created_at), ''Mon YYYY'') AS period,
  SUM(soi.quantity * soi.unit_price) AS revenue,
  SUM(soi.quantity * soi.cost_per_unit) AS cogs,
  SUM(soi.quantity * soi.unit_price) - SUM(soi.quantity * soi.cost_per_unit) AS gross_margin,
  CASE WHEN SUM(soi.quantity * soi.unit_price) > 0
    THEN ((SUM(soi.quantity * soi.unit_price) - SUM(soi.quantity * soi.cost_per_unit)) / SUM(soi.quantity * soi.unit_price)) * 100
    ELSE 0 END AS margin_pct
FROM sales_order_items soi
JOIN sales_orders so ON so.id = soi.sales_order_id
WHERE so.organization_id = :org_id
  AND so.status IN (''fulfilled'', ''invoiced'', ''paid'', ''closed'')
  AND so.created_at >= :start_date
  AND so.created_at <= :end_date
GROUP BY date_trunc(''month'', so.created_at)
ORDER BY date_trunc(''month'', so.created_at)'
WHERE name = 'Margins by Timeframe' AND organization_id IS NULL;
