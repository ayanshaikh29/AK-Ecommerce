-- ========================================================
-- GST / HSN / MOV / GROCERY CATEGORY MIGRATION (v3)
-- Run this in your Supabase SQL editor
-- ========================================================

-- 1. Add HSN Code to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS hsn_code TEXT;

-- 2. Add GST Rate (%) to products table (default 18%)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS gst_percent NUMERIC(5,2) DEFAULT 18;

-- 3. Add minimum order value per category (NULL = no minimum)
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS min_order_value NUMERIC(10,2) DEFAULT NULL;

-- 4. Add supplier/business state to settings (for CGST/SGST vs IGST logic)
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS supplier_state TEXT DEFAULT 'Maharashtra';

-- 5. Set category-level minimum order values for existing categories
UPDATE public.categories SET min_order_value = 5000 WHERE slug = 'housekeeping';
UPDATE public.categories SET min_order_value = 2000 WHERE slug = 'office-stationery';
UPDATE public.categories SET min_order_value = NULL WHERE slug = 'ups-solutions';

-- 6. Add Grocery category if it does not exist yet
INSERT INTO public.categories (id, name, slug, description, image_url, icon, min_order_value, created_at)
SELECT
  gen_random_uuid(),
  'Grocery',
  'grocery',
  'Daily groceries, pantry supplies & office kitchen essentials',
  '/category-grocery.jpg',
  'ShoppingBasket',
  NULL,
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories WHERE slug = 'grocery'
);

-- 7. Update supplier state in settings
UPDATE public.settings SET supplier_state = 'Maharashtra' WHERE id = 'main';

-- 8. Seed sample HSN codes and GST rates for existing products (best-effort)
-- HSN 4820 = Books/notebooks/stationery; GST 12%
UPDATE public.products SET hsn_code = '4820', gst_percent = 12
WHERE category_id = (SELECT id FROM public.categories WHERE slug = 'office-stationery' LIMIT 1)
AND (hsn_code IS NULL OR hsn_code = '');

-- HSN 3402 = Cleaning preparations; GST 18%
UPDATE public.products SET hsn_code = '3402', gst_percent = 18
WHERE category_id = (SELECT id FROM public.categories WHERE slug = 'housekeeping' LIMIT 1)
AND (hsn_code IS NULL OR hsn_code = '');

-- HSN 8504 = UPS/electrical transformers; GST 18%
UPDATE public.products SET hsn_code = '8504', gst_percent = 18
WHERE category_id = (SELECT id FROM public.categories WHERE slug = 'ups-solutions' LIMIT 1)
AND (hsn_code IS NULL OR hsn_code = '');

-- HSN 2106 = Food preparations; GST 5%
UPDATE public.products SET hsn_code = '2106', gst_percent = 5
WHERE category_id = (SELECT id FROM public.categories WHERE slug = 'grocery' LIMIT 1)
AND (hsn_code IS NULL OR hsn_code = '');
