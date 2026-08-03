-- Add company legal columns to settings table for local GST invoice generation
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS company_gstin TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS company_pan TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS company_registered_address TEXT;
