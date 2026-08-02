-- Migration to add customer profile fields to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS gst_number TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pincode TEXT;

-- Refresh the PostgREST schema cache
NOTIFY pgrst, 'reload schema';
