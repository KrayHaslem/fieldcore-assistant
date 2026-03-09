
-- Bill of Materials table
CREATE TABLE public.bill_of_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  finished_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  component_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  quantity_per_unit NUMERIC(12,4) NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (organization_id, finished_item_id, component_item_id)
);

CREATE INDEX idx_bom_org_finished ON public.bill_of_materials(organization_id, finished_item_id);

ALTER TABLE public.bill_of_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org isolation select" ON public.bill_of_materials FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Org isolation insert" ON public.bill_of_materials FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Org isolation update" ON public.bill_of_materials FOR UPDATE TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Org isolation delete" ON public.bill_of_materials FOR DELETE TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE TRIGGER update_bom_updated_at
  BEFORE UPDATE ON public.bill_of_materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to get component stock levels
CREATE OR REPLACE FUNCTION public.get_component_stock(_org_id UUID, _item_ids UUID[])
RETURNS TABLE(item_id UUID, on_hand BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT im.item_id, COALESCE(SUM(im.quantity), 0)::BIGINT AS on_hand
  FROM inventory_movements im
  WHERE im.organization_id = _org_id
    AND im.item_id = ANY(_item_ids)
  GROUP BY im.item_id;
$$;
