-- SUPABASE_MIGRATION_REQUIREMENT_EXCLUSIONS.sql
-- Módulo de Farmacia / Análisis: Lista de Exclusiones de Medicamentos por Establecimiento
-- Permite que cada IPRESS excluya medicamentos específicos durante el Análisis de Requerimiento.
-- Ejecutar en Supabase SQL Editor.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Crear tabla de listas de exclusión
CREATE TABLE IF NOT EXISTS public.requirement_exclusion_lists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    establishment_code VARCHAR(20) NOT NULL,
    sismed_code VARCHAR(20) NOT NULL,
    description VARCHAR(255) NOT NULL,
    presentation VARCHAR(100) DEFAULT '',
    reason TEXT DEFAULT '',
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Índices para búsquedas rápidas y prevención de duplicados por establecimiento
CREATE UNIQUE INDEX IF NOT EXISTS idx_req_exclusions_est_sismed 
ON public.requirement_exclusion_lists (establishment_code, sismed_code);

CREATE INDEX IF NOT EXISTS idx_req_exclusions_est_code 
ON public.requirement_exclusion_lists (establishment_code);

CREATE INDEX IF NOT EXISTS idx_req_exclusions_sismed_code 
ON public.requirement_exclusion_lists (sismed_code);

-- 3. Habilitar Seguridad RLS
ALTER TABLE public.requirement_exclusion_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_sesion_valida ON public.requirement_exclusion_lists;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'app_request_has_session') THEN
    CREATE POLICY app_sesion_valida ON public.requirement_exclusion_lists
      FOR ALL TO anon, authenticated
      USING (public.app_request_has_session())
      WITH CHECK (public.app_request_has_session());
  ELSE
    CREATE POLICY app_sesion_valida ON public.requirement_exclusion_lists
      FOR ALL TO anon, authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
