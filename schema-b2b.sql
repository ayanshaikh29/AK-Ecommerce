-- ========================================================
-- B2B PRIVATE ORDERING PORTAL SCHEMA UPDATES
-- ========================================================

-- 1. Customer Product Pricing Table
CREATE TABLE IF NOT EXISTS public.customer_product_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    custom_price NUMERIC(10, 2) NOT NULL,
    is_visible BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT customer_product_unique UNIQUE (customer_id, product_id)
);

ALTER TABLE public.customer_product_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service_role full access customer_product_pricing" 
ON public.customer_product_pricing FOR ALL USING (true);


-- 2. Stock Movements Table
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    movement_type TEXT CHECK (movement_type IN ('intake', 'outward')) NOT NULL,
    quantity INT NOT NULL,
    reference TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service_role full access stock_movements" 
ON public.stock_movements FOR ALL USING (true);


-- 3. Vendors Table
CREATE TABLE IF NOT EXISTS public.vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service_role full access vendors" 
ON public.vendors FOR ALL USING (true);


-- 4. Order Table Column Updates
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS assigned_vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Pending';


-- 5. Settings Table Column Updates
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS min_order_quantity INT DEFAULT 6000;
UPDATE public.settings SET min_order_quantity = 6000 WHERE id = 'main' AND (min_order_quantity IS NULL OR min_order_quantity = 0);
