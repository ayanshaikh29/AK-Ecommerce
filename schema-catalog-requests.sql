-- ================================================
-- REALTIME CATALOG ACCESS REQUESTS SCHEMA
-- ================================================

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

-- Index for fast status lookups per customer
CREATE INDEX IF NOT EXISTS idx_catalog_requests_customer ON public.catalog_access_requests(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_catalog_requests_status ON public.catalog_access_requests(status);

-- Enable Supabase Realtime CDC (Change Data Capture)
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.catalog_access_requests;

-- RLS Policies (Allow public insert and read)
ALTER TABLE public.catalog_access_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated catalog request inserts" ON public.catalog_access_requests;
CREATE POLICY "Allow authenticated catalog request inserts" 
  ON public.catalog_access_requests 
  FOR INSERT 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow catalog request reads" ON public.catalog_access_requests;
CREATE POLICY "Allow catalog request reads" 
  ON public.catalog_access_requests 
  FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Allow catalog request updates" ON public.catalog_access_requests;
CREATE POLICY "Allow catalog request updates" 
  ON public.catalog_access_requests 
  FOR UPDATE 
  USING (true);
