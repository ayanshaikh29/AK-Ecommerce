-- Migration to add assigned_vendor_id column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS assigned_vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL;
