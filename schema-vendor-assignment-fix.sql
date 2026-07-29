-- ========================================================
-- VENDOR ASSIGNMENT FIX MIGRATION
-- ========================================================

-- 1. ADD MISSING COLUMNS TO ORDERS TABLE
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS vendor_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS vendor_email TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS assigned_by TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS status_history JSONB DEFAULT '[]'::jsonb;

-- 2. FIX STATUS CHECK CONSTRAINT (drop old one if exists, recreate with all valid statuses)
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  -- Find any existing CHECK constraint on the status column
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_attribute att ON att.attnum = ANY(con.conkey)
  WHERE rel.relname = 'orders'
    AND att.attname = 'status'
    AND con.contype = 'c';

  -- Drop the constraint if it exists
  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.orders DROP CONSTRAINT ' || constraint_name;
  END IF;
END $$;

-- Add the new CHECK constraint with all valid statuses
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'pending',
    'confirmed',
    'vendor_assigned',
    'vendor_accepted',
    'packed',
    'shipped',
    'out_for_delivery',
    'delivered',
    'rejected',
    'cancelled',
    'vendor_rejected'
  ));

-- 3. CREATE NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'general',
    is_read BOOLEAN DEFAULT false,
    link TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access
DROP POLICY IF EXISTS "Allow service_role full access notifications" ON public.notifications;
CREATE POLICY "Allow service_role full access notifications"
ON public.notifications FOR ALL USING (true);

-- Allow users to read their own notifications
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
CREATE POLICY "Users can read own notifications"
ON public.notifications FOR SELECT
USING (user_id = auth.uid());

-- 4. ENABLE REALTIME FOR NOTIFICATIONS TABLE
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 5. ENSURE REALTIME IS ENABLED FOR ORDERS TABLE
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.orders;
