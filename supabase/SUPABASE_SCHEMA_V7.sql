-- SUPABASE_SCHEMA_V7.sql
-- Añadir columna description a roles_config para poder darles descripciones más detalladas a los roles

ALTER TABLE public.roles_config 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Forzar recarga del esquema en PostgREST / Supabase
NOTIFY pgrst, 'reload schema';
