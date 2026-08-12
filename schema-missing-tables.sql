-- ================================================
-- CREATE MISSING TABLES FOR FACTORY RESET
-- ================================================

-- 1. Return Requests Table
CREATE TABLE IF NOT EXISTS public.return_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    details TEXT DEFAULT '',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own return requests" 
    ON public.return_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own return requests" 
    ON public.return_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage all return requests" 
    ON public.return_requests FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

-- 2. Bulk Enquiries Table
CREATE TABLE IF NOT EXISTS public.bulk_enquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT DEFAULT '',
    contact_person TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT DEFAULT '',
    products_needed TEXT NOT NULL,
    quantity TEXT DEFAULT '',
    message TEXT DEFAULT '',
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'resolved')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.bulk_enquiries ENABLE ROW LEVEL SECURITY;

-- Policies (admin only for read, public for insert)
CREATE POLICY "Admins can view all bulk enquiries" 
    ON public.bulk_enquiries FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );
CREATE POLICY "Anyone can submit bulk enquiries" 
    ON public.bulk_enquiries FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can update bulk enquiries" 
    ON public.bulk_enquiries FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

-- 3. Activity Logs Table
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    user_name TEXT NOT NULL,
    user_email TEXT,
    user_avatar TEXT,
    event_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow full access for activity_logs"
    ON public.activity_logs FOR ALL USING (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.activity_logs;

-- 4. Chat Logs Table
CREATE TABLE IF NOT EXISTS public.chat_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    user_id TEXT,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow read access for service_role only" ON public.chat_logs FOR SELECT USING (true);
CREATE POLICY "Allow write access for service_role only" ON public.chat_logs FOR ALL USING (true);

-- 5. Product Q&A Table
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

-- Enable RLS
ALTER TABLE public.product_qa ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read access for all users" ON public.product_qa FOR SELECT USING (true);
CREATE POLICY "Enable write access for authenticated users" ON public.product_qa FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable write access for service_role" ON public.product_qa FOR ALL USING (true);

-- 6. Catalog Access Requests Table
CREATE TABLE IF NOT EXISTS public.catalog_access_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    email TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'fulfilled')),
    message TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_catalog_requests_customer ON public.catalog_access_requests(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_catalog_requests_status ON public.catalog_access_requests(status);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.catalog_access_requests;

-- Enable RLS
ALTER TABLE public.catalog_access_requests ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow authenticated catalog request inserts" 
    ON public.catalog_access_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow catalog request reads" 
    ON public.catalog_access_requests FOR SELECT USING (true);
CREATE POLICY "Allow catalog request updates" 
    ON public.catalog_access_requests FOR UPDATE USING (true);

-- 7. Product Requests Table
CREATE TABLE IF NOT EXISTS public.product_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    description TEXT,
    quantity_needed INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_requests ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own product requests" 
    ON public.product_requests FOR ALL USING (auth.uid() = customer_id);
CREATE POLICY "Admins can view and update all product requests" 
    ON public.product_requests FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

-- Enable Realtime
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.product_requests;
    END IF;
END $$;
