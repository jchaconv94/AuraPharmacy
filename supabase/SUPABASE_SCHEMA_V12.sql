-- SUPABASE_SCHEMA_V12.sql

CREATE TABLE IF NOT EXISTS public.facility_stock_assignments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    admin_username TEXT NOT NULL REFERENCES public.users(username) ON DELETE CASCADE,
    facility_code TEXT NOT NULL REFERENCES public.facilities(code) ON DELETE CASCADE,
    sheet_name TEXT NOT NULL,
    sheet_url TEXT NOT NULL,
    visible_columns JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.facility_stock_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir todo temporalmente facility_stock_assignments" ON public.facility_stock_assignments;
CREATE POLICY "Permitir todo temporalmente facility_stock_assignments" ON public.facility_stock_assignments 
    FOR ALL USING (true) WITH CHECK (true);
