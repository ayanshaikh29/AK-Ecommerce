-- 1. Referral Program Columns
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referred_by_id UUID REFERENCES public.users(id);

-- Generate referral codes for existing users
UPDATE public.users 
SET referral_code = 'AKREF' || upper(substring(id::text, 1, 6)) 
WHERE referral_code IS NULL;

-- 2. Promotional Banner Countdown Columns
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ;
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS show_countdown BOOLEAN DEFAULT false;

-- 3. Product Q&A Table
CREATE TABLE IF NOT EXISTS public.product_qa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    user_email TEXT,
    question TEXT NOT NULL,
    answer TEXT,
    answered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for Q&A
ALTER TABLE public.product_qa ENABLE ROW LEVEL SECURITY;

-- Q&A Policies
CREATE POLICY "Enable read access for all users" ON public.product_qa FOR SELECT USING (true);
CREATE POLICY "Enable write access for authenticated users" ON public.product_qa FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable write access for service_role" ON public.product_qa FOR ALL USING (true);

-- 4. Product Brand Column
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS brand TEXT;

-- Seed brand values for existing products
UPDATE public.products SET brand = 'AK Premium' WHERE brand IS NULL AND category_id = (SELECT id FROM public.categories WHERE slug = 'ups-solutions' LIMIT 1);
UPDATE public.products SET brand = 'Camlin' WHERE brand IS NULL AND (name ILIKE '%marker%' OR name ILIKE '%pen%' OR name ILIKE '%board%');
UPDATE public.products SET brand = 'Classmate' WHERE brand IS NULL AND (name ILIKE '%notebook%' OR name ILIKE '%diary%' OR name ILIKE '%book%');
UPDATE public.products SET brand = 'Dettol' WHERE brand IS NULL AND (name ILIKE '%handwash%' OR name ILIKE '%antiseptic%' OR name ILIKE '%sanitizer%');
UPDATE public.products SET brand = 'Vim' WHERE brand IS NULL AND (name ILIKE '%dishwash%' OR name ILIKE '%gel%');
UPDATE public.products SET brand = 'AK Quality' WHERE brand IS NULL;

-- 5. Legal Policies Columns in Settings Table
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS policy_privacy TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS policy_terms TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS policy_refund TEXT;

-- Seed B2B Policy texts
UPDATE public.settings 
SET 
  policy_privacy = 'AK Enterprises ("we", "our", or "us") respects the privacy of our corporate and individual clients. This Privacy Policy details how we collect, store, and process business contact details, order history, shipping addresses, and cookies to enable order tracking and tailored corporate recommendations. We do not sell or share business details with unverified third parties, except as required for logistics delivery partners or credit compliance checks. All account and session information is securely handled in compliance with India''s IT Act and GDPR principles.',
  policy_terms = 'Welcome to AK Enterprises (akenterprises.in). By placing a purchase order or registering on our site, you agree to these Terms & Conditions. We operate primarily as a B2B supplier. All listed prices are wholesale, and standard GST tax invoices will be issued under the registration details supplied at checkout. Payment is Cash on Delivery (COD) only. Net credits/Invoiced terms may be extended to pre-registered corporate partners on a case-by-case basis. Logistics dispatch occurs within 1-2 days within Maharashtra, and 3-5 days pan-India.',
  policy_refund = 'Given the B2B wholesale nature of our products, all sales are standard. However, we offer an Easy 7-Day Return Policy for items that are delivered damaged, defective, or incorrect. Clients must log into their admin panel and submit a "Return Request" indicating the item state and invoice reference. Since we support COD (Cash on Delivery), refunds for approved returns will be credited back via bank wire transfer or custom credit note against your next purchase order. The return courier logistics will be arranged by our logistics partners.'
WHERE id = 'main';
