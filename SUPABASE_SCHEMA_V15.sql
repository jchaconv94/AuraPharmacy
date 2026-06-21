-- SUPABASE_SCHEMA_V15.sql
-- Run this SQL in your Supabase SQL Editor to support the Sync SISMED 2.0 updates.

-- 1. Add audit columns to public.sync_installations
ALTER TABLE public.sync_installations ADD COLUMN IF NOT EXISTS last_sismed_path TEXT;
ALTER TABLE public.sync_installations ADD COLUMN IF NOT EXISTS path_changed_at TIMESTAMPTZ;
ALTER TABLE public.sync_installations ADD COLUMN IF NOT EXISTS detected_almcods TEXT[];

-- Update comments for clarity
COMMENT ON COLUMN public.sync_installations.last_sismed_path IS 'Ruta local reportada en el último envío exitoso.';
COMMENT ON COLUMN public.sync_installations.path_changed_at IS 'Fecha y hora en la que cambió la ruta SISMED por última vez.';
COMMENT ON COLUMN public.sync_installations.detected_almcods IS 'Arreglo de códigos ALMCOD válidos detectados y reportados por este dispositivo.';
