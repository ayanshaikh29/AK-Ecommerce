-- ============================================================
-- AK Enterprises — Client Error Logging Table
-- Run this migration in your Supabase SQL Editor ONCE.
-- ============================================================

-- Table to capture browser/client-side React crashes
CREATE TABLE IF NOT EXISTS client_errors (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message     TEXT NOT NULL DEFAULT '',
  stack       TEXT NOT NULL DEFAULT '',
  url         TEXT NOT NULL DEFAULT '',
  context     TEXT NOT NULL DEFAULT '',   -- e.g. "SectionErrorBoundary[Shipping Address]"
  user_role   TEXT NOT NULL DEFAULT 'unknown',
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast admin queries by time (most recent first)
CREATE INDEX IF NOT EXISTS idx_client_errors_created_at ON client_errors(created_at DESC);

-- Optional: auto-purge errors older than 90 days to keep table small
-- (comment out if you want to retain all logs)
-- CREATE OR REPLACE FUNCTION purge_old_client_errors()
-- RETURNS void LANGUAGE sql AS $$
--   DELETE FROM client_errors WHERE created_at < NOW() - INTERVAL '90 days';
-- $$;

-- Allow the service role (used by API) to insert and select
-- (Supabase service role already bypasses RLS by default — no extra policy needed)
