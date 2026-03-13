
-- Add subscription_active column to organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS subscription_active boolean NOT NULL DEFAULT false;

-- Helper function to check if an org has an active subscription
CREATE OR REPLACE FUNCTION public.is_org_subscription_active(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT subscription_active FROM public.organizations WHERE id = _org_id),
    false
  )
$$;

-- RLS policy: block INSERT on purchase_orders for unpaid orgs
CREATE POLICY "Require active subscription for insert"
ON public.purchase_orders
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (is_org_subscription_active(organization_id));

-- RLS policy: block INSERT on sales_orders for unpaid orgs
CREATE POLICY "Require active subscription for insert"
ON public.sales_orders
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (is_org_subscription_active(organization_id));

-- RLS policy: block INSERT on customers for unpaid orgs
CREATE POLICY "Require active subscription for insert"
ON public.customers
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (is_org_subscription_active(organization_id));

-- RLS policy: block INSERT on suppliers for unpaid orgs
CREATE POLICY "Require active subscription for insert"
ON public.suppliers
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (is_org_subscription_active(organization_id));
