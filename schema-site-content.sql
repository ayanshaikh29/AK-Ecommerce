-- ========================================================
-- SITE CONTENT MANAGEMENT (CMS) TABLE
-- Stores editable content for Homepage, About, Contact pages
-- ========================================================

CREATE TABLE IF NOT EXISTS public.site_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page TEXT NOT NULL,
  section TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text',
  content_value TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (page, section)
);

-- Enable RLS
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

-- Allow public read access
DROP POLICY IF EXISTS "Public can read site_content" ON public.site_content;
CREATE POLICY "Public can read site_content"
ON public.site_content FOR SELECT
USING (true);

-- Allow authenticated users (admin) full access
DROP POLICY IF EXISTS "Admin can manage site_content" ON public.site_content;
CREATE POLICY "Admin can manage site_content"
ON public.site_content FOR ALL
USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));

-- Seed default content (matches current hardcoded values)
INSERT INTO public.site_content (page, section, content_type, content_value) VALUES
  ('homepage', 'hero_title', 'text', 'Your Trusted'),
  ('homepage', 'hero_title_accent', 'text', 'B2B Partner'),
  ('homepage', 'hero_subtitle', 'text', 'Office Stationery · Housekeeping · UPS Solutions'),
  ('homepage', 'hero_badge', 'text', 'Est. 2020 — Pune, India'),
  ('homepage', 'hero_image', 'image', '/category-stationery.jpg'),
  ('homepage', 'hero_color', 'color', '#120606'),
  ('homepage', 'promo_strip', 'text', 'Free Pan-India Delivery on Bulk Orders'),
  ('homepage', 'featured_banner_title', 'text', 'Bulk orders? Custom quotes in 2 hours.'),
  ('homepage', 'featured_banner_text', 'text', 'Corporate purchase for 100+ units? WhatsApp us or use our contact form.'),
  ('about', 'about_body', 'richtext', '<p>Your trusted partner for office stationery, housekeeping solutions & UPS supply. Established in 2020, serving businesses pan-India from Pune.</p>'),
  ('about', 'mission', 'richtext', '<p>To provide high-quality products and dependable services that help businesses maintain efficient, clean, and productive workplaces.</p>'),
  ('about', 'vision', 'richtext', '<p>To become one of India''s most trusted suppliers of office essentials and facility support products.</p>'),
  ('contact', 'address', 'text', 'Pune, Maharashtra'),
  ('contact', 'phone', 'text', '+91 83088 60894'),
  ('contact', 'email', 'text', 'akenterprises1411@gmail.com'),
  ('contact', 'contact_person', 'text', 'Mr. Sagar Lahole'),
  ('contact', 'business_hours', 'text', 'Mon–Sat: 9:30 AM – 7:00 PM'),
  ('contact', 'custom_text', 'text', 'Bulk orders, corporate quotes, product inquiries — we''re here to help.')
ON CONFLICT (page, section) DO NOTHING;

-- Enable realtime for instant reflection
ALTER PUBLICATION supabase_realtime ADD TABLE public.site_content;
