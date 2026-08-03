CREATE TABLE IF NOT EXISTS public.stock_assignments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    admin_username TEXT NOT NULL REFERENCES public.users(username) ON DELETE CASCADE,
    target_username TEXT NOT NULL REFERENCES public.users(username) ON DELETE CASCADE,
    sheet_name TEXT NOT NULL,
    sheet_url TEXT NOT NULL,
    visible_columns JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.stock_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view and manage assignments they created" ON public.stock_assignments;
DROP POLICY IF EXISTS "Users can view their assignments" ON public.stock_assignments;
DROP POLICY IF EXISTS "Permitir todo temporalmente stock_assignments" ON public.stock_assignments;

CREATE POLICY "Permitir todo temporalmente stock_assignments" ON public.stock_assignments 
    FOR ALL USING (true) WITH CHECK (true);
