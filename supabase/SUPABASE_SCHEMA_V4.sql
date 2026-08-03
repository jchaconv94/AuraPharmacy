-- SUPABASE_SCHEMA_V4.sql
-- Agregar campos de ubicación geográfica a la tabla facilities
ALTER TABLE public.facilities 
ADD COLUMN IF NOT EXISTS department TEXT,
ADD COLUMN IF NOT EXISTS province TEXT,
ADD COLUMN IF NOT EXISTS district TEXT;

-- Forzar recarga del esquema en PostgREST
NOTIFY pgrst, 'reload schema';
