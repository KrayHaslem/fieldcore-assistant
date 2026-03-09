-- Add partially_received to po_status enum
ALTER TYPE public.po_status ADD VALUE IF NOT EXISTS 'partially_received' AFTER 'ordered';

-- Add has_shortfall to purchase_orders
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS has_shortfall boolean NOT NULL DEFAULT false;

-- Add shortfall_notes to purchase_order_items
ALTER TABLE public.purchase_order_items ADD COLUMN IF NOT EXISTS shortfall_notes text;