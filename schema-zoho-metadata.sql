-- Migration to add Zoho Books metadata fields to public.orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS zoho_invoice_number TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS zoho_pdf_url TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS zoho_invoice_status TEXT DEFAULT 'pending';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS zoho_customer_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS zoho_contact_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS zoho_created_time TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS zoho_last_modified_time TEXT;

-- Reload schema cache to make columns visible in PostgREST
NOTIFY pgrst, 'reload schema';
