-- ========================================================
-- ORDER STATUS CHECK CONSTRAINT (includes admin approval flow)
-- ========================================================
-- Supports the full B2B order lifecycle:
--   pending_vendor_acceptance → vendor_accepted_pending_admin_approval → confirmed
--   OR pending_admin_approval (direct to admin) → confirmed
--   Also supports rejection: admin_rejected

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

-- 2. Add new CHECK constraint with ALL valid statuses
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'pending',
    'pending_vendor_acceptance',
    'pending_admin_approval',
    'vendor_accepted_pending_admin_approval',
    'admin_rejected',
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
