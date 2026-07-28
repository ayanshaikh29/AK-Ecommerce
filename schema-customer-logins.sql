-- Customer Logins Table for Admin Realtime Notifications
-- Run this in Supabase Dashboard -> SQL Editor after deploy

CREATE TABLE IF NOT EXISTS public.customer_logins (
    id UUID PRIMARY KEY,
    user_id UUID,
    user_name TEXT,
    email TEXT,
    phone TEXT,
    login_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.customer_logins ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Allow service_role full access customer_logins"
    ON public.customer_logins FOR ALL USING (true);

-- Add column for JSON fallback (used when customer_logins table is unavailable)
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS b2b_customer_logins JSONB DEFAULT '[]'::jsonb;

-- Enable realtime for the table (required for live admin notifications)
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.customer_logins;
