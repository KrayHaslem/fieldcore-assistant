
-- =============================================
-- FIELDCORE RESOURCE SYSTEMS - CORE SCHEMA
-- =============================================

-- Role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'procurement', 'sales', 'finance', 'employee');

-- Inventory type enum
CREATE TYPE public.inventory_type AS ENUM ('resale', 'manufacturing_input', 'internal_use', 'consumable');

-- PO status enum
CREATE TYPE public.po_status AS ENUM ('draft', 'submitted', 'approved', 'ordered', 'received', 'closed');

-- Sales order status enum
CREATE TYPE public.so_status AS ENUM ('quote', 'order', 'fulfilled', 'invoiced', 'paid', 'closed');

-- Movement type enum
CREATE TYPE public.movement_type AS ENUM ('purchase', 'sale', 'adjustment', 'reconciliation', 'consumption', 'received', 'assembled');

-- Source type enum
CREATE TYPE public.source_type AS ENUM ('purchase_order', 'sales_order', 'reconciliation', 'assembly_record', 'manual');

-- =============================================
-- ORGANIZATIONS
-- =============================================
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  industry TEXT,
  settings JSONB DEFAULT '{}',
  terms_accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PROFILES (linked to auth.users)
-- =============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- USER ROLES (separate table per security guidelines)
-- =============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE(user_id, role, organization_id)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- DEPARTMENTS
-- =============================================
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- =============================================
-- SUPPLIERS
-- =============================================
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  avg_lead_time_days INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- =============================================
-- UNITS (equipment/vehicles)
-- =============================================
CREATE TABLE public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  unit_number TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- =============================================
-- INVENTORY ITEMS
-- =============================================
CREATE TABLE public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT,
  item_type inventory_type NOT NULL DEFAULT 'resale',
  default_unit_cost NUMERIC(12,2),
  reorder_point INTEGER,
  preferred_supplier_id UUID REFERENCES public.suppliers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PURCHASE ORDERS
-- =============================================
CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  po_number TEXT NOT NULL,
  supplier_id UUID REFERENCES public.suppliers(id),
  department_id UUID REFERENCES public.departments(id),
  status po_status NOT NULL DEFAULT 'draft',
  total_amount NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  ordered_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PURCHASE ORDER ITEMS
-- =============================================
CREATE TABLE public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES public.inventory_items(id) NOT NULL,
  quantity INTEGER NOT NULL,
  unit_cost NUMERIC(12,2) NOT NULL,
  item_type inventory_type NOT NULL,
  unit_id UUID REFERENCES public.units(id),
  quantity_received INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

-- =============================================
-- SALES ORDERS
-- =============================================
CREATE TABLE public.sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  so_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  status so_status NOT NULL DEFAULT 'order',
  total_amount NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;

-- =============================================
-- SALES ORDER ITEMS
-- =============================================
CREATE TABLE public.sales_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  sales_order_id UUID REFERENCES public.sales_orders(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES public.inventory_items(id) NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;

-- =============================================
-- INVENTORY MOVEMENTS
-- =============================================
CREATE TABLE public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES public.inventory_items(id) NOT NULL,
  movement_type movement_type NOT NULL,
  quantity INTEGER NOT NULL,
  source_type source_type NOT NULL,
  source_id UUID,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- =============================================
-- ASSEMBLY RECORDS
-- =============================================
CREATE TABLE public.assembly_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  finished_item_id UUID REFERENCES public.inventory_items(id) NOT NULL,
  quantity_produced INTEGER NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.assembly_records ENABLE ROW LEVEL SECURITY;

-- =============================================
-- ASSEMBLY RECORD COMPONENTS
-- =============================================
CREATE TABLE public.assembly_record_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_record_id UUID REFERENCES public.assembly_records(id) ON DELETE CASCADE NOT NULL,
  component_item_id UUID REFERENCES public.inventory_items(id) NOT NULL,
  quantity_consumed INTEGER NOT NULL
);
ALTER TABLE public.assembly_record_components ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RECONCILIATIONS
-- =============================================
CREATE TABLE public.reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES public.inventory_items(id) NOT NULL,
  expected_quantity INTEGER NOT NULL,
  actual_quantity INTEGER NOT NULL,
  variance INTEGER NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reconciliations ENABLE ROW LEVEL SECURITY;

-- =============================================
-- APPROVAL RULES
-- =============================================
CREATE TABLE public.approval_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  department_id UUID REFERENCES public.departments(id),
  min_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  max_amount NUMERIC(12,2),
  required_role app_role NOT NULL,
  approver_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.approval_rules ENABLE ROW LEVEL SECURITY;

-- =============================================
-- REPORT TEMPLATES
-- =============================================
CREATE TABLE public.report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sql_query TEXT NOT NULL,
  chart_type TEXT NOT NULL DEFAULT 'table',
  access_level app_role NOT NULL DEFAULT 'admin',
  supports_date_range BOOLEAN DEFAULT true,
  supports_quarterly BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;

-- =============================================
-- COMMAND HISTORY
-- =============================================
CREATE TABLE public.command_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  command_text TEXT NOT NULL,
  intent_type TEXT,
  intent_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.command_history ENABLE ROW LEVEL SECURITY;

-- =============================================
-- SECURITY DEFINER FUNCTIONS
-- =============================================

-- Get user's organization_id
CREATE OR REPLACE FUNCTION public.get_user_org_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- =============================================
-- RLS POLICIES
-- =============================================

-- Organizations: users can see their own org
CREATE POLICY "Users see own org" ON public.organizations
  FOR SELECT USING (id = public.get_user_org_id(auth.uid()));

-- Profiles: users see own org profiles
CREATE POLICY "Users see org profiles" ON public.profiles
  FOR SELECT USING (organization_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- User roles
CREATE POLICY "Users see own roles" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin') AND organization_id = public.get_user_org_id(auth.uid()));

-- Generic org-scoped policies for all data tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'departments', 'suppliers', 'units', 'inventory_items',
    'purchase_orders', 'purchase_order_items', 'sales_orders', 'sales_order_items',
    'inventory_movements', 'assembly_records', 'reconciliations',
    'approval_rules', 'report_templates', 'command_history'
  ])
  LOOP
    EXECUTE format(
      'CREATE POLICY "Org isolation select" ON public.%I FOR SELECT USING (organization_id = public.get_user_org_id(auth.uid()))',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY "Org isolation insert" ON public.%I FOR INSERT WITH CHECK (organization_id = public.get_user_org_id(auth.uid()))',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY "Org isolation update" ON public.%I FOR UPDATE USING (organization_id = public.get_user_org_id(auth.uid()))',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY "Org isolation delete" ON public.%I FOR DELETE USING (organization_id = public.get_user_org_id(auth.uid()))',
      tbl
    );
  END LOOP;
END $$;

-- Assembly record components: inherit from parent
CREATE POLICY "Components select" ON public.assembly_record_components
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.assembly_records ar WHERE ar.id = assembly_record_id AND ar.organization_id = public.get_user_org_id(auth.uid()))
  );
CREATE POLICY "Components insert" ON public.assembly_record_components
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.assembly_records ar WHERE ar.id = assembly_record_id AND ar.organization_id = public.get_user_org_id(auth.uid()))
  );

-- =============================================
-- UPDATED_AT TRIGGER
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'organizations', 'profiles', 'suppliers', 'inventory_items',
    'purchase_orders', 'sales_orders'
  ])
  LOOP
    EXECUTE format(
      'CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
      tbl, tbl
    );
  END LOOP;
END $$;

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_profiles_org ON public.profiles(organization_id);
CREATE INDEX idx_profiles_user ON public.profiles(user_id);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_inventory_items_org ON public.inventory_items(organization_id);
CREATE INDEX idx_purchase_orders_org ON public.purchase_orders(organization_id);
CREATE INDEX idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX idx_sales_orders_org ON public.sales_orders(organization_id);
CREATE INDEX idx_inventory_movements_item ON public.inventory_movements(item_id);
CREATE INDEX idx_inventory_movements_org ON public.inventory_movements(organization_id);
CREATE INDEX idx_command_history_user ON public.command_history(user_id);
