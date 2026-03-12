
-- Create customers table mirroring suppliers
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact_name text,
  contact_email text,
  contact_phone text,
  address text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Org-isolation RLS policies
CREATE POLICY "Org isolation select" ON public.customers FOR SELECT USING (organization_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org isolation insert" ON public.customers FOR INSERT WITH CHECK (organization_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org isolation update" ON public.customers FOR UPDATE USING (organization_id = get_user_org_id(auth.uid()));
CREATE POLICY "Org isolation delete" ON public.customers FOR DELETE USING (organization_id = get_user_org_id(auth.uid()));

-- updated_at trigger
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add customer_id FK to sales_orders
ALTER TABLE public.sales_orders ADD COLUMN customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
