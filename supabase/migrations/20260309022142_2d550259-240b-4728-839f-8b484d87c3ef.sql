
-- Create po_groups table
CREATE TABLE public.po_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  po_number TEXT NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, po_number)
);

-- Enable RLS
ALTER TABLE public.po_groups ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Org isolation select" ON public.po_groups FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Org isolation insert" ON public.po_groups FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Org isolation update" ON public.po_groups FOR UPDATE TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Org isolation delete" ON public.po_groups FOR DELETE TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()));

-- Add po_group_id to purchase_orders
ALTER TABLE public.purchase_orders ADD COLUMN po_group_id UUID REFERENCES public.po_groups(id);

-- Updated_at trigger for po_groups
CREATE TRIGGER update_po_groups_updated_at
  BEFORE UPDATE ON public.po_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
