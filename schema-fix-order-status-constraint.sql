-- ========================================================
-- ADD pending_vendor_acceptance STATUS TO ORDERS CONSTRAINT
-- ========================================================
-- The new order workflow uses pending_vendor_acceptance as initial status
-- but the existing CHECK constraint doesn't include it.

-- 1. Drop existing constraint
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_attribute att ON att.attnum = ANY(con.conkey)
  WHERE rel.relname = 'orders'
    AND att.attname = 'status'
    AND con.contype = 'c';

  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.orders DROP CONSTRAINT ' || constraint_name;
  END IF;
END $$;

-- 2. Add new CHECK constraint with all valid statuses including pending_vendor_acceptance
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'pending',
    'pending_vendor_acceptance',
    'confirmed',
    'vendor_assigned',
    'vendor_accepted',
    'packed',
    'shipped',
    'out_for_delivery',
    'delivered',
    'rejected',
    'cancelled',
    'vendor_rejected',
    'returned'
  ));
