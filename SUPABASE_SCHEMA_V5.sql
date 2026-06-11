-- SUPABASE_SCHEMA_V5.sql
-- Agregar campos de ubicación geográfica a ungets y microredes
ALTER TABLE public.ungets 
ADD COLUMN IF NOT EXISTS department TEXT,
ADD COLUMN IF NOT EXISTS province TEXT,
ADD COLUMN IF NOT EXISTS district TEXT;

ALTER TABLE public.microredes 
ADD COLUMN IF NOT EXISTS department TEXT,
ADD COLUMN IF NOT EXISTS province TEXT,
ADD COLUMN IF NOT EXISTS district TEXT;

-- Forzar recarga del esquema en PostgREST
NOTIFY pgrst, 'reload schema';
