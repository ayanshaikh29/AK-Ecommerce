-- Create invoice_generation_logs table for tracking document issues
CREATE TABLE IF NOT EXISTS public.invoice_generation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL, -- 'invoice' or 'challan'
    status TEXT NOT NULL, -- 'success' or 'failure'
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoice_generation_logs ENABLE ROW LEVEL SECURITY;

-- Allow all admin users to read logs
CREATE POLICY "Allow admin read access to generation logs" ON public.invoice_generation_logs
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid() AND users.role = 'admin'
        )
    );
