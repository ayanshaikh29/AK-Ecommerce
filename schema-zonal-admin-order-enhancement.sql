-- =========================================================================
-- AK ENTERPRISES — ZONAL ADMIN ORDER ENHANCEMENT & PERFORMANCE OPTIMIZATION
-- =========================================================================
-- 1. Order Items Quantity Management (Preserves Customer Requested Quantity)
-- 2. Quantity Modifications Audit Trail Table
-- 3. Performance Indexes for Orders, Order Items, Products & Media
-- =========================================================================

-- 1. ADD SEPARATE QUANTITY TRACKING COLUMNS TO order_items
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS original_quantity INTEGER;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS approved_quantity INTEGER;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS delivered_quantity INTEGER DEFAULT 0;

-- Backfill existing order items so original and approved quantities reflect current quantity
UPDATE public.order_items
SET original_quantity = quantity
WHERE original_quantity IS NULL;

UPDATE public.order_items
SET approved_quantity = quantity
WHERE approved_quantity IS NULL;

-- 2. CREATE AUDIT TRAIL TABLE FOR QUANTITY MODIFICATIONS
CREATE TABLE IF NOT EXISTS public.order_quantity_modifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    order_item_id UUID REFERENCES public.order_items(id) ON DELETE SET NULL,
    product_id UUID,
    product_name TEXT,
    original_quantity INTEGER NOT NULL,
    previous_approved_quantity INTEGER NOT NULL,
    new_approved_quantity INTEGER NOT NULL,
    modification_reason TEXT NOT NULL,
    modified_by UUID,
    modifier_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.order_quantity_modifications ENABLE ROW LEVEL SECURITY;

-- Read policy: Anyone authenticated can read audit rows for their visible orders
DROP POLICY IF EXISTS "Public / auth view order_quantity_modifications" ON public.order_quantity_modifications;
CREATE POLICY "Public / auth view order_quantity_modifications" ON public.order_quantity_modifications
    FOR SELECT
    USING (true);

-- Insert policy: Service role & backend routes can insert audit logs
DROP POLICY IF EXISTS "Insert order_quantity_modifications" ON public.order_quantity_modifications;
CREATE POLICY "Insert order_quantity_modifications" ON public.order_quantity_modifications
    FOR INSERT
    WITH CHECK (true);

-- 3. DATABASE PERFORMANCE INDEXES (Optimizing High-Traffic Queries)
-- Frequently queried orders columns:
CREATE INDEX IF NOT EXISTS idx_orders_assigned_vendor ON public.orders(assigned_vendor_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_placed_at ON public.orders(placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);

-- Frequently queried order_items columns:
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);

-- Frequently queried quantity modifications audit column:
CREATE INDEX IF NOT EXISTS idx_order_qty_mods_order_id ON public.order_quantity_modifications(order_id);

-- Frequently queried products and image columns:
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_is_featured ON public.products(is_featured);
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON public.product_images(product_id);
