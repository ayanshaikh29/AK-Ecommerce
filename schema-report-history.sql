-- ================================================================
-- REPORT HISTORY TABLE
-- Run once in the Supabase SQL Editor (Dashboard → SQL → New query)
-- This table powers the Report History feature. The report service
-- degrades gracefully (direct download, no history) until it exists.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.report_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_type TEXT NOT NULL,                  -- 'orders' | 'sales' | 'gst' | ...
    user_id UUID,                               -- who generated it
    user_email TEXT,
    zone_id TEXT,                               -- NULL = all zones (owner)
    zone_name TEXT,
    filters JSONB DEFAULT '{}'::jsonb,          -- applied filters
    date_range JSONB DEFAULT '{}'::jsonb,       -- {start,end,range}
    file_name TEXT,
    file_size BIGINT DEFAULT 0,
    status TEXT DEFAULT 'completed'
        CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'expired')),
    error_message TEXT,
    download_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ                      -- files expire after 7 days
);

CREATE INDEX IF NOT EXISTS idx_report_history_created_at ON public.report_history (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_history_user_id ON public.report_history (user_id);

-- RLS: service role has full access (the API uses the service role key).
ALTER TABLE public.report_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_report_history" ON public.report_history;
CREATE POLICY "service_role_full_access_report_history"
    ON public.report_history FOR ALL USING (true);

-- Owners may read all rows through the API (which uses service role),
-- so no additional per-user policy is needed for the app's API.
