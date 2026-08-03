-- SUPABASE_SCHEMA_V8.sql
-- Agregar la columna labor_regime a la tabla de personal (personnel) para indicar su régimen laboral
ALTER TABLE public.personnel 
ADD COLUMN IF NOT EXISTS labor_regime TEXT;

-- Forzar recarga del esquema en PostgREST / Supabase
NOTIFY pgrst, 'reload schema';
