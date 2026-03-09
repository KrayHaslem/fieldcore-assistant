-- First ensure report_templates has correct policies
-- Drop the existing select policy which requires org_id match
DROP POLICY IF EXISTS "Org isolation select" ON public.report_templates;

-- Create a new policy that allows reading if org_id is NULL (system-wide) OR matches user's org
CREATE POLICY "Org isolation select" 
  ON public.report_templates 
  FOR SELECT 
  USING (organization_id IS NULL OR organization_id = get_user_org_id(auth.uid()));

-- Seed the 17 system templates
-- Note: 'sql_query' isn't really used yet because we still run inline queries, but we need to insert it
INSERT INTO public.report_templates (name, description, chart_type, access_level, supports_date_range, sql_query, organization_id)
VALUES 
-- Purchasing
('Spending by Supplier', 'Total spend grouped by supplier', 'bar', 'procurement', true, 'SELECT 1', NULL),
('Monthly Purchase Totals', 'Purchase spend by month as a bar chart', 'bar', 'procurement', true, 'SELECT 1', NULL),
('Quarterly Spending', 'Purchase spend grouped by quarter', 'bar', 'procurement', true, 'SELECT 1', NULL),
('Open Purchase Orders', 'All POs not yet closed, grouped by status', 'table', 'procurement', false, 'SELECT 1', NULL),
('Pending Approvals', 'POs awaiting approval by department', 'table', 'procurement', false, 'SELECT 1', NULL),
('Purchase History by Item', 'All purchases of a specific item over time', 'table', 'procurement', true, 'SELECT 1', NULL),

-- Inventory
('Inventory Valuation', 'On-hand quantity x unit cost per item', 'table', 'procurement', false, 'SELECT 1', NULL),
('Reconciliation History', 'Expected vs actual and variance over time', 'table', 'procurement', true, 'SELECT 1', NULL),
('Inventory Performance by Item', 'Movement history per item as a net quantity trend', 'line', 'procurement', true, 'SELECT 1', NULL),
('Recommended Stock Levels', 'Suggested reorder quantities based on sales velocity and lead time', 'table', 'procurement', false, 'SELECT 1', NULL),
('Inventory Loss Summary', 'Items with negative reconciliation variance', 'table', 'procurement', true, 'SELECT 1', NULL),
('Assembly History', 'Finished goods produced over time with components consumed', 'table', 'procurement', true, 'SELECT 1', NULL),

-- Sales
('Sales by Item', 'Units sold and revenue per item', 'table', 'sales', true, 'SELECT 1', NULL),
('Margin by Item', 'Revenue minus cost of goods sold per item', 'table', 'finance', true, 'SELECT 1', NULL),
('Quarterly Revenue', 'Total revenue grouped by quarter', 'bar', 'sales', true, 'SELECT 1', NULL),
('Sales by Salesperson', 'Total sales value and units per sales user', 'table', 'sales', true, 'SELECT 1', NULL),
('Margins by Timeframe', 'Gross margin with weekly, monthly, or quarterly grouping', 'table', 'finance', true, 'SELECT 1', NULL)
ON CONFLICT DO NOTHING;