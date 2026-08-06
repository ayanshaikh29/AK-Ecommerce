-- Email Logs table for tracking order confirmation emails
-- Run this migration in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  order_number TEXT,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('customer', 'zonal_admin', 'owner')),
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for quick lookups by order
CREATE INDEX IF NOT EXISTS idx_email_logs_order_id ON email_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Only admin can read email logs
CREATE POLICY "Admin can view email logs" ON email_logs
  FOR SELECT USING (auth.uid() IN (
    SELECT id FROM users WHERE role = 'admin'
  ));

-- Allow API (service role) to insert email logs
CREATE POLICY "Service role can insert email logs" ON email_logs
  FOR INSERT WITH CHECK (true);
