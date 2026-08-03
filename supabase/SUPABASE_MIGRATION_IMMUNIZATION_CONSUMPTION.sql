-- SUPABASE_MIGRATION_IMMUNIZATION_CONSUMPTION.sql
-- Fase: Consumo IPRESS por registro con varios productos/lotes.
-- Ejecutar despues de:
--   SUPABASE_SCHEMA_IMMUNIZATIONS_V1.sql
--   SUPABASE_MIGRATION_IMMUNIZATION_REGIONAL_REFACTOR.sql

ALTER TABLE public.immunization_stock_movements
ADD COLUMN IF NOT EXISTS batch_id TEXT,
ADD COLUMN IF NOT EXISTS consumed_doses NUMERIC,
ADD COLUMN IF NOT EXISTS doses_applied NUMERIC,
ADD COLUMN IF NOT EXISTS doses_lost NUMERIC,
ADD COLUMN IF NOT EXISTS loss_factor NUMERIC;

CREATE INDEX IF NOT EXISTS immunization_movements_type_period_idx
ON public.immunization_stock_movements (movement_type, period);

CREATE INDEX IF NOT EXISTS immunization_movements_batch_idx
ON public.immunization_stock_movements (batch_id)
WHERE batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS immunization_movements_facility_period_idx
ON public.immunization_stock_movements (facility_code, period)
WHERE owner_type = 'IPRESS';

UPDATE public.roles_config
SET allowed_modules =
    CASE
        WHEN COALESCE(allowed_modules, '[]'::jsonb) ? 'IMMUNIZATION_CONSUMPTION' THEN COALESCE(allowed_modules, '[]'::jsonb)
        ELSE COALESCE(allowed_modules, '[]'::jsonb) || '["IMMUNIZATION_CONSUMPTION"]'::jsonb
    END
WHERE role IN ('ADMIN', 'INMU_DIRESA', 'INMU_UNGET', 'INMU_IPRESS');

NOTIFY pgrst, 'reload schema';
