-- 1. Add GST Number to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS gst_number TEXT;

-- 2. Create product requests table
CREATE TABLE IF NOT EXISTS public.product_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  description TEXT,
  quantity_needed INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable row level security (RLS)
ALTER TABLE public.product_requests ENABLE ROW LEVEL SECURITY;

-- Remove existing policies if they exist to prevent conflicts
DROP POLICY IF EXISTS "Users can manage their own product requests" ON public.product_requests;
DROP POLICY IF EXISTS "Admins can view and update all product requests" ON public.product_requests;

-- Create policies
CREATE POLICY "Users can manage their own product requests" 
  ON public.product_requests FOR ALL USING (auth.uid() = customer_id);
CREATE POLICY "Admins can view and update all product requests" 
  ON public.product_requests FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- 4. Enable Supabase Realtime for product requests (if publication exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.product_requests;
  END IF;
END $$;
