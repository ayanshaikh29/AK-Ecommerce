-- Add GST column to addresses table
-- Run this in Supabase SQL Editor

ALTER TABLE addresses ADD COLUMN IF NOT EXISTS gst text;

-- Verify the column was added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'addresses' AND column_name = 'gst';