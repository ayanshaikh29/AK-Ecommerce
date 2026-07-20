-- 1. Create FAQs Table
CREATE TABLE IF NOT EXISTS public.faqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS) for FAQs
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;

-- Create Policies for FAQs
CREATE POLICY "Enable read access for all users" ON public.faqs FOR SELECT USING (true);
CREATE POLICY "Enable write access for service_role only" ON public.faqs FOR ALL USING (true);

-- 2. Create Chat Logs Table
CREATE TABLE IF NOT EXISTS public.chat_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    user_id TEXT,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS) for Chat Logs
ALTER TABLE public.chat_logs ENABLE ROW LEVEL SECURITY;

-- Create Policies for Chat Logs
CREATE POLICY "Enable read access for service_role only" ON public.chat_logs FOR SELECT USING (true);
CREATE POLICY "Enable write access for service_role only" ON public.chat_logs FOR ALL USING (true);

-- 3. Populate Sample B2B FAQs
INSERT INTO public.faqs (question, answer, sort_order) VALUES
('What are your business hours?', 'We are open Monday to Saturday, 9:30 AM to 6:30 PM. We are closed on Sundays and public holidays.', 1),
('What payment methods do you support?', 'We currently support Cash on Delivery (COD) for all orders. Bank transfers can be arranged for bulk corporate purchases.', 2),
('What are the shipping charges?', 'Shipping is free for orders above ₹2,000. For orders below ₹2,000, a flat shipping fee of ₹150 is charged.', 3),
('What is the delivery timeline?', 'Orders within Maharashtra are typically delivered in 1-2 business days. Delivery to other locations in India takes 3-5 business days.', 4),
('How do I place a bulk order?', 'For bulk orders, you can use our Contact Form or click "Request Bulk Quote" to get a customized quotation within 2 hours. You can also chat with us directly on WhatsApp.', 5);
