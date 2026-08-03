-- SUPABASE_SCHEMA_V6.sql
-- Agregar la columna microred_id a la tabla de personal (personnel)
ALTER TABLE public.personnel 
ADD COLUMN IF NOT EXISTS microred_id UUID REFERENCES public.microredes(id) ON DELETE SET NULL;

-- Forzar recarga del esquema en PostgREST / Supabase
NOTIFY pgrst, 'reload schema';
