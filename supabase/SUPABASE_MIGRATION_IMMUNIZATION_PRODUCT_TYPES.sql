-- SUPABASE_MIGRATION_IMMUNIZATION_PRODUCT_TYPES.sql
-- Módulo de Inmunizaciones: Catálogo dinámico de Tipos de Producto
-- Ejecutar en Supabase SQL Editor.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Crear tabla de tipos de producto
CREATE TABLE IF NOT EXISTS public.immunization_product_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by TEXT REFERENCES public.users(username) ON DELETE SET NULL,
    updated_by TEXT REFERENCES public.users(username) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS immunization_product_types_code_idx ON public.immunization_product_types (code);
CREATE INDEX IF NOT EXISTS immunization_product_types_active_idx ON public.immunization_product_types (is_active);

-- 2. Insertar valores por defecto (si no existen)
INSERT INTO public.immunization_product_types (code, name, description, is_active)
VALUES
  ('VACUNA', 'Vacuna', 'Biológicos de inmunización', true),
  ('JERINGA', 'Jeringa', 'Dispositivos de inyección y aplicación', true),
  ('DILUYENTE', 'Diluyente', 'Soluciones reconstituyentes para biológicos', true)
ON CONFLICT (code) DO NOTHING;

-- 3. Habilitar Seguridad RLS
ALTER TABLE public.immunization_product_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_sesion_valida ON public.immunization_product_types;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'app_request_has_session') THEN
    CREATE POLICY app_sesion_valida ON public.immunization_product_types
      FOR ALL TO anon, authenticated
      USING (public.app_request_has_session())
      WITH CHECK (public.app_request_has_session());
  ELSE
    CREATE POLICY app_sesion_valida ON public.immunization_product_types
      FOR ALL TO anon, authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 4. Modificar constraint en la tabla de productos para permitir tipos de producto dinámicos
ALTER TABLE public.immunization_products DROP CONSTRAINT IF EXISTS immunization_products_tipo_producto_check;
