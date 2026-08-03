-- SUPABASE_MIGRATION_IMMUNIZATION_RETURNS.sql
-- Fase: devoluciones, transferencias y bajas IPRESS -> UNGET.

CREATE TABLE IF NOT EXISTS public.immunization_return_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_type TEXT NOT NULL CHECK (return_type IN ('DISPOSAL', 'RETURN', 'TRANSFER')),
    status TEXT NOT NULL DEFAULT 'SENT' CHECK (status IN ('SENT', 'RECEIVED', 'OBSERVED', 'VOIDED')),
    origin_unget_id TEXT NOT NULL,
    origin_facility_code TEXT NOT NULL,
    suggested_destination_facility_code TEXT,
    period TEXT NOT NULL,
    movement_date DATE NOT NULL,
    reference_document TEXT,
    reason TEXT NOT NULL CHECK (reason IN ('VENCIDO', 'DETERIORADO', 'RUPTURA', 'CADENA_FRIO', 'DEVOLUCION', 'TRANSFERENCIA', 'OTRO')),
    observation TEXT,
    created_by TEXT,
    sent_at TIMESTAMPTZ,
    received_by TEXT,
    received_at TIMESTAMPTZ,
    reception_reason TEXT,
    reception_observation TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS immunization_return_batches_origin_unget_idx
ON public.immunization_return_batches (origin_unget_id);

CREATE INDEX IF NOT EXISTS immunization_return_batches_origin_facility_idx
ON public.immunization_return_batches (origin_facility_code);

CREATE INDEX IF NOT EXISTS immunization_return_batches_period_idx
ON public.immunization_return_batches (period);

CREATE INDEX IF NOT EXISTS immunization_return_batches_status_idx
ON public.immunization_return_batches (status);

CREATE TABLE IF NOT EXISTS public.immunization_return_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id UUID NOT NULL REFERENCES public.immunization_return_batches(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.immunization_products(id) ON DELETE RESTRICT,
    source_stock_layer_id UUID NOT NULL REFERENCES public.immunization_stock_layers(id) ON DELETE RESTRICT,
    codigo_sismed_snapshot TEXT NOT NULL,
    lote TEXT NOT NULL,
    expiration_date DATE NOT NULL,
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC NOT NULL DEFAULT 0,
    funding_source TEXT NOT NULL,
    supply_type TEXT NOT NULL,
    observation TEXT,
    received_quantity NUMERIC,
    destination_stock_layer_id UUID REFERENCES public.immunization_stock_layers(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS immunization_return_items_return_idx
ON public.immunization_return_items (return_id);

CREATE INDEX IF NOT EXISTS immunization_return_items_source_layer_idx
ON public.immunization_return_items (source_stock_layer_id);

ALTER TABLE public.immunization_return_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.immunization_return_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir todo temporalmente immunization_return_batches" ON public.immunization_return_batches;
CREATE POLICY "Permitir todo temporalmente immunization_return_batches"
ON public.immunization_return_batches
FOR ALL
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir todo temporalmente immunization_return_items" ON public.immunization_return_items;
CREATE POLICY "Permitir todo temporalmente immunization_return_items"
ON public.immunization_return_items
FOR ALL
USING (true)
WITH CHECK (true);

UPDATE public.roles_config
SET allowed_modules =
    CASE
        WHEN COALESCE(allowed_modules, '[]'::jsonb) ? 'IMMUNIZATION_RETURNS' THEN COALESCE(allowed_modules, '[]'::jsonb)
        ELSE COALESCE(allowed_modules, '[]'::jsonb) || '["IMMUNIZATION_RETURNS"]'::jsonb
    END
WHERE role IN ('ADMIN', 'INMU_DIRESA', 'INMU_UNGET', 'INMU_IPRESS');
