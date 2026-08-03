-- SUPABASE_MIGRATION_IMMUNIZATION_INCOMES.sql
-- Etapa 2 / Fase 11: ingresos nuevos al stock biologico de UNGET.
-- Ejecutar despues de SUPABASE_SCHEMA_IMMUNIZATIONS_V1.sql.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.immunization_income_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_type TEXT NOT NULL DEFAULT 'UNGET' CHECK (owner_type = 'UNGET'),
    unget_id UUID NOT NULL REFERENCES public.ungets(id) ON DELETE CASCADE,
    period TEXT NOT NULL CHECK (period ~ '^[0-9]{4}-[0-9]{2}$'),
    source_type TEXT NOT NULL CHECK (source_type IN ('OGESS', 'UNGET_TRANSFER', 'OTHER')),
    source_unget_id UUID REFERENCES public.ungets(id) ON DELETE SET NULL,
    source_name TEXT,
    reference_document TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPLIED', 'VOIDED')),
    observation TEXT,
    created_by TEXT REFERENCES public.users(username) ON DELETE SET NULL,
    applied_by TEXT REFERENCES public.users(username) ON DELETE SET NULL,
    applied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT immunization_income_transfer_origin_chk CHECK (
        source_type <> 'UNGET_TRANSFER'
        OR
        (source_unget_id IS NOT NULL AND source_unget_id <> unget_id)
    )
);

CREATE INDEX IF NOT EXISTS immunization_income_batches_unget_idx
ON public.immunization_income_batches (unget_id);

CREATE INDEX IF NOT EXISTS immunization_income_batches_period_idx
ON public.immunization_income_batches (period);

CREATE INDEX IF NOT EXISTS immunization_income_batches_status_idx
ON public.immunization_income_batches (status);

CREATE TABLE IF NOT EXISTS public.immunization_income_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    income_id UUID NOT NULL REFERENCES public.immunization_income_batches(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.immunization_products(id) ON DELETE RESTRICT,
    codigo_sismed_snapshot TEXT NOT NULL,
    lote TEXT NOT NULL,
    expiration_date DATE NOT NULL,
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC NOT NULL CHECK (unit_price >= 0),
    funding_source TEXT NOT NULL,
    supply_type TEXT NOT NULL,
    observation TEXT,
    stock_layer_id UUID REFERENCES public.immunization_stock_layers(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS immunization_income_items_income_idx
ON public.immunization_income_items (income_id);

CREATE INDEX IF NOT EXISTS immunization_income_items_product_idx
ON public.immunization_income_items (product_id);

CREATE INDEX IF NOT EXISTS immunization_income_items_lote_idx
ON public.immunization_income_items (lote);

CREATE OR REPLACE FUNCTION public.apply_immunization_income(
    p_income_id UUID,
    p_applied_by TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_income RECORD;
    v_item RECORD;
    v_layer_id UUID;
    v_before NUMERIC;
    v_after NUMERIC;
    v_movement_id UUID;
BEGIN
    SELECT *
    INTO v_income
    FROM public.immunization_income_batches
    WHERE id = p_income_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'INCOME_NOT_FOUND';
    END IF;

    IF v_income.status <> 'DRAFT' THEN
        RAISE EXCEPTION 'INCOME_ALREADY_APPLIED';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.immunization_income_items
        WHERE income_id = p_income_id
    ) THEN
        RAISE EXCEPTION 'INCOME_WITHOUT_ITEMS';
    END IF;

    FOR v_item IN
        SELECT *
        FROM public.immunization_income_items
        WHERE income_id = p_income_id
        ORDER BY created_at, id
    LOOP
        v_layer_id := NULL;
        v_before := 0;

        SELECT id, current_quantity
        INTO v_layer_id, v_before
        FROM public.immunization_stock_layers
        WHERE owner_type = 'UNGET'
          AND unget_id = v_income.unget_id
          AND facility_code IS NULL
          AND product_id = v_item.product_id
          AND lote = v_item.lote
          AND expiration_date = v_item.expiration_date
          AND unit_price = v_item.unit_price
          AND funding_source = v_item.funding_source
          AND supply_type = v_item.supply_type
        LIMIT 1
        FOR UPDATE;

        v_after := COALESCE(v_before, 0) + v_item.quantity;

        IF v_layer_id IS NULL THEN
            INSERT INTO public.immunization_stock_layers (
                owner_type,
                unget_id,
                facility_code,
                product_id,
                lote,
                expiration_date,
                unit_price,
                funding_source,
                supply_type,
                current_quantity,
                is_active,
                created_at,
                updated_at
            ) VALUES (
                'UNGET',
                v_income.unget_id,
                NULL,
                v_item.product_id,
                v_item.lote,
                v_item.expiration_date,
                v_item.unit_price,
                v_item.funding_source,
                v_item.supply_type,
                v_after,
                true,
                now(),
                now()
            )
            RETURNING id INTO v_layer_id;
        ELSE
            UPDATE public.immunization_stock_layers
            SET current_quantity = v_after,
                is_active = true,
                updated_at = now()
            WHERE id = v_layer_id;
        END IF;

        INSERT INTO public.immunization_stock_movements (
            movement_type,
            owner_type,
            unget_id,
            facility_code,
            product_id,
            stock_layer_id,
            quantity_delta,
            quantity_before,
            quantity_after,
            period,
            reason,
            observation,
            created_by,
            created_at
        ) VALUES (
            'UNGET_INCOME',
            'UNGET',
            v_income.unget_id,
            NULL,
            v_item.product_id,
            v_layer_id,
            v_item.quantity,
            COALESCE(v_before, 0),
            v_after,
            v_income.period,
            CASE v_income.source_type
                WHEN 'OGESS' THEN 'Ingreso desde OGESS'
                WHEN 'UNGET_TRANSFER' THEN 'Ingreso por transferencia de otra UNGET'
                ELSE 'Ingreso externo'
            END,
            CONCAT_WS(' | ', NULLIF(v_income.reference_document, ''), NULLIF(v_income.observation, ''), NULLIF(v_item.observation, '')),
            p_applied_by,
            now()
        )
        RETURNING id INTO v_movement_id;

        UPDATE public.immunization_stock_layers
        SET source_movement_id = COALESCE(source_movement_id, v_movement_id)
        WHERE id = v_layer_id;

        UPDATE public.immunization_income_items
        SET stock_layer_id = v_layer_id
        WHERE id = v_item.id;
    END LOOP;

    UPDATE public.immunization_income_batches
    SET status = 'APPLIED',
        applied_by = p_applied_by,
        applied_at = now(),
        updated_at = now()
    WHERE id = p_income_id;

    RETURN p_income_id;
END;
$$;

ALTER TABLE public.immunization_income_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.immunization_income_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir todo temporalmente immunization_income_batches" ON public.immunization_income_batches;
CREATE POLICY "Permitir todo temporalmente immunization_income_batches"
ON public.immunization_income_batches
FOR ALL
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir todo temporalmente immunization_income_items" ON public.immunization_income_items;
CREATE POLICY "Permitir todo temporalmente immunization_income_items"
ON public.immunization_income_items
FOR ALL
USING (true)
WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
