-- =========================================================================
-- AK ENTERPRISES — COMPLETE DATABASE UPGRADE SCRIPT
-- RUN THIS IN SUPABASE SQL EDITOR (Dashboard -> SQL Editor -> New Query)
-- =========================================================================

-- PART 1: USERNAME SUPPORT FOR ZONAL ADMINS & USERS
-----------------------------------------------------------------------------
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS username TEXT;

ALTER TABLE public.vendors 
ADD COLUMN IF NOT EXISTS username TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower_unique 
ON public.users (LOWER(username)) 
WHERE username IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vendors_username_lower 
ON public.vendors (LOWER(username)) 
WHERE username IS NOT NULL;

-- Backfill usernames for existing vendors safely
UPDATE public.users 
SET username = LOWER(REGEXP_REPLACE(SPLIT_PART(email, '@', 1), '[^a-zA-Z0-9_]', '_', 'g'))
WHERE username IS NULL AND role = 'vendor';

UPDATE public.vendors v
SET username = u.username
FROM public.users u
WHERE v.user_id = u.id AND v.username IS NULL AND u.username IS NOT NULL;


-- PART 2: ORDER ITEMS QUANTITY MANAGEMENT (ORIGINAL vs APPROVED)
-----------------------------------------------------------------------------
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS original_quantity INTEGER;

ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS approved_quantity INTEGER;

ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS delivered_quantity INTEGER DEFAULT 0;

-- Backfill existing orders
UPDATE public.order_items
SET original_quantity = quantity
WHERE original_quantity IS NULL;

UPDATE public.order_items
SET approved_quantity = quantity
WHERE approved_quantity IS NULL;


-- PART 3: QUANTITY MODIFICATION AUDIT TRAIL TABLE
-----------------------------------------------------------------------------
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

ALTER TABLE public.order_quantity_modifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public / auth view order_quantity_modifications" ON public.order_quantity_modifications;
CREATE POLICY "Public / auth view order_quantity_modifications" ON public.order_quantity_modifications
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Insert order_quantity_modifications" ON public.order_quantity_modifications;
CREATE POLICY "Insert order_quantity_modifications" ON public.order_quantity_modifications
    FOR INSERT WITH CHECK (true);


-- PART 4: HIGH-SPEED PERFORMANCE INDEXES (DATABASE OPTIMIZATION)
-----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_assigned_vendor ON public.orders(assigned_vendor_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_placed_at ON public.orders(placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);

CREATE INDEX IF NOT EXISTS idx_order_qty_mods_order_id ON public.order_quantity_modifications(order_id);

CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_is_featured ON public.products(is_featured);
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON public.product_images(product_id);
