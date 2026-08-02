-- Add columns to store Zoho Invoice ID and Zoho Delivery Challan ID on orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS zoho_invoice_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS zoho_challan_id TEXT;
