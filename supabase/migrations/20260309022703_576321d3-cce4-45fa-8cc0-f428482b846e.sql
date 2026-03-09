
-- Fix RLS on report_templates: drop generic policies, add proper ones

DROP POLICY IF EXISTS "Org isolation delete" ON public.report_templates;
DROP POLICY IF EXISTS "Org isolation insert" ON public.report_templates;
DROP POLICY IF EXISTS "Org isolation select" ON public.report_templates;
DROP POLICY IF EXISTS "Org isolation update" ON public.report_templates;

-- SELECT: org-owned rows OR system templates (org_id IS NULL)
CREATE POLICY "Select own org or system templates"
  ON public.report_templates FOR SELECT TO authenticated
  USING (organization_id IS NULL OR organization_id = get_user_org_id(auth.uid()));

-- INSERT: only org-owned rows (no inserting system templates)
CREATE POLICY "Insert org templates only"
  ON public.report_templates FOR INSERT TO authenticated
  WITH CHECK (organization_id IS NOT NULL AND organization_id = get_user_org_id(auth.uid()));

-- UPDATE: only org-owned rows
CREATE POLICY "Update org templates only"
  ON public.report_templates FOR UPDATE TO authenticated
  USING (organization_id IS NOT NULL AND organization_id = get_user_org_id(auth.uid()));

-- DELETE: only org-owned rows
CREATE POLICY "Delete org templates only"
  ON public.report_templates FOR DELETE TO authenticated
  USING (organization_id IS NOT NULL AND organization_id = get_user_org_id(auth.uid()));

-- Add source_template_id for tracking overrides
ALTER TABLE public.report_templates
  ADD COLUMN IF NOT EXISTS source_template_id UUID REFERENCES public.report_templates(id);
