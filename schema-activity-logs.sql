-- Schema for Activity Logs & Live Monitoring
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    user_name TEXT NOT NULL,
    user_email TEXT,
    user_avatar TEXT,
    event_type TEXT NOT NULL, -- 'login', 'logout', 'signup', 'order', 'payment', 'wishlist', 'profile_update', 'system'
    title TEXT NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Allow full access for service_role and authenticated admin
CREATE POLICY "Allow full access for activity_logs"
    ON public.activity_logs FOR ALL USING (true);

-- Enable Realtime publication for activity_logs
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.activity_logs;
