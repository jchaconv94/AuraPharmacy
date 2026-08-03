-- SUPABASE_MIGRATION_IMMUNIZATION_DISTRIBUTIONS.sql
-- Etapa 2 / Fase 12: distribucion de biologicos desde UNGET hacia IPRESS.
-- Ejecutar despues de SUPABASE_SCHEMA_IMMUNIZATIONS_V1.sql y SUPABASE_MIGRATION_IMMUNIZATION_INCOMES.sql.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.immunization_distribution_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unget_id UUID NOT NULL REFERENCES public.ungets(id) ON DELETE CASCADE,
    destination_facility_code TEXT NOT NULL REFERENCES public.facilities(code) ON DELETE CASCADE,
    period TEXT NOT NULL CHECK (period ~ '^[0-9]{4}-[0-9]{2}$'),
    criterion TEXT NOT NULL DEFAULT 'REGULAR' CHECK (criterion IN ('CONSUMPTION', 'AVAILABILITY', 'CAMPAIGN', 'REGULAR', 'OTHER')),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SENT', 'RECEIVED', 'OBSERVED', 'VOIDED')),
    reference_document TEXT,
    observation TEXT,
    created_by TEXT REFERENCES public.users(username) ON DELETE SET NULL,
    sent_by TEXT REFERENCES public.users(username) ON DELETE SET NULL,
    sent_at TIMESTAMPTZ,
    received_by TEXT REFERENCES public.users(username) ON DELETE SET NULL,
    received_at TIMESTAMPTZ,
    reception_reason TEXT,
    reception_observation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.immunization_distribution_batches
ADD COLUMN IF NOT EXISTS criterion TEXT NOT NULL DEFAULT 'REGULAR';

ALTER TABLE public.immunization_distribution_batches
ADD COLUMN IF NOT EXISTS reception_reason TEXT;

ALTER TABLE public.immunization_distribution_batches
ADD COLUMN IF NOT EXISTS reception_observation TEXT;

CREATE INDEX IF NOT EXISTS immunization_distribution_batches_unget_idx
ON public.immunization_distribution_batches (unget_id);

CREATE INDEX IF NOT EXISTS immunization_distribution_batches_facility_idx
ON public.immunization_distribution_batches (destination_facility_code);

CREATE INDEX IF NOT EXISTS immunization_distribution_batches_period_idx
ON public.immunization_distribution_batches (period);

CREATE INDEX IF NOT EXISTS immunization_distribution_batches_status_idx
ON public.immunization_distribution_batches (status);

ALTER TABLE public.immunization_distribution_batches
ADD COLUMN IF NOT EXISTS criterion TEXT NOT NULL DEFAULT 'REGULAR';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'immunization_distribution_batches_criterion_chk'
    ) THEN
        ALTER TABLE public.immunization_distribution_batches
        ADD CONSTRAINT immunization_distribution_batches_criterion_chk
        CHECK (criterion IN ('CONSUMPTION', 'AVAILABILITY', 'CAMPAIGN', 'REGULAR', 'OTHER'));
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.immunization_distribution_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    distribution_id UUID NOT NULL REFERENCES public.immunization_distribution_batches(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.immunization_products(id) ON DELETE RESTRICT,
    source_stock_layer_id UUID NOT NULL REFERENCES public.immunization_stock_layers(id) ON DELETE RESTRICT,
    codigo_sismed_snapshot TEXT NOT NULL,
    lote TEXT NOT NULL,
    expiration_date DATE NOT NULL,
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC NOT NULL CHECK (unit_price >= 0),
    funding_source TEXT NOT NULL,
    supply_type TEXT NOT NULL,
    observation TEXT,
    received_quantity NUMERIC,
    destination_stock_layer_id UUID REFERENCES public.immunization_stock_layers(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.immunization_distribution_items
ADD COLUMN IF NOT EXISTS received_quantity NUMERIC;

ALTER TABLE public.immunization_distribution_items
ADD COLUMN IF NOT EXISTS destination_stock_layer_id UUID REFERENCES public.immunization_stock_layers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS immunization_distribution_items_batch_idx
ON public.immunization_distribution_items (distribution_id);

CREATE INDEX IF NOT EXISTS immunization_distribution_items_product_idx
ON public.immunization_distribution_items (product_id);

CREATE INDEX IF NOT EXISTS immunization_distribution_items_source_layer_idx
ON public.immunization_distribution_items (source_stock_layer_id);

CREATE OR REPLACE FUNCTION public.send_immunization_distribution(
    p_distribution_id UUID,
    p_sent_by TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_batch RECORD;
    v_item RECORD;
    v_facility_unget UUID;
    v_before NUMERIC;
    v_after NUMERIC;
BEGIN
    SELECT *
    INTO v_batch
    FROM public.immunization_distribution_batches
    WHERE id = p_distribution_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'DISTRIBUTION_NOT_FOUND';
    END IF;

    IF v_batch.status <> 'DRAFT' THEN
        RAISE EXCEPTION 'DISTRIBUTION_NOT_DRAFT';
    END IF;

    SELECT unget_id
    INTO v_facility_unget
    FROM public.facilities
    WHERE code = v_batch.destination_facility_code;

    IF v_facility_unget IS DISTINCT FROM v_batch.unget_id THEN
        RAISE EXCEPTION 'DESTINATION_OUT_OF_UNGET';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.immunization_distribution_items
        WHERE distribution_id = p_distribution_id
    ) THEN
        RAISE EXCEPTION 'DISTRIBUTION_WITHOUT_ITEMS';
    END IF;

    FOR v_item IN
        SELECT *
        FROM public.immunization_distribution_items
        WHERE distribution_id = p_distribution_id
        ORDER BY created_at, id
    LOOP
        SELECT current_quantity
        INTO v_before
        FROM public.immunization_stock_layers
        WHERE id = v_item.source_stock_layer_id
          AND owner_type = 'UNGET'
          AND unget_id = v_batch.unget_id
          AND product_id = v_item.product_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'SOURCE_STOCK_NOT_FOUND';
        END IF;

        IF v_before < v_item.quantity THEN
            RAISE EXCEPTION 'INSUFFICIENT_STOCK';
        END IF;

        v_after := v_before - v_item.quantity;

        UPDATE public.immunization_stock_layers
        SET current_quantity = v_after,
            is_active = (v_after > 0),
            updated_at = now()
        WHERE id = v_item.source_stock_layer_id;

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
            'UNGET_DISTRIBUTION_OUT',
            'UNGET',
            v_batch.unget_id,
            NULL,
            v_item.product_id,
            v_item.source_stock_layer_id,
            -v_item.quantity,
            v_before,
            v_after,
            v_batch.period,
            'Distribucion a IPRESS pendiente de recepcion',
            CONCAT_WS(' | ', v_batch.destination_facility_code, NULLIF(v_batch.reference_document, ''), NULLIF(v_batch.observation, ''), NULLIF(v_item.observation, '')),
            p_sent_by,
            now()
        );
    END LOOP;

    UPDATE public.immunization_distribution_batches
    SET status = 'SENT',
        sent_by = p_sent_by,
        sent_at = now(),
        updated_at = now()
    WHERE id = p_distribution_id;

    RETURN p_distribution_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.receive_immunization_distribution(
    p_distribution_id UUID,
    p_received_by TEXT DEFAULT NULL,
    p_observation TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_batch RECORD;
    v_item RECORD;
    v_layer_id UUID;
    v_before NUMERIC;
    v_after NUMERIC;
    v_movement_id UUID;
    v_received NUMERIC;
BEGIN
    SELECT *
    INTO v_batch
    FROM public.immunization_distribution_batches
    WHERE id = p_distribution_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'DISTRIBUTION_NOT_FOUND';
    END IF;

    IF v_batch.status <> 'SENT' THEN
        RAISE EXCEPTION 'DISTRIBUTION_NOT_PENDING';
    END IF;

    FOR v_item IN
        SELECT *
        FROM public.immunization_distribution_items
        WHERE distribution_id = p_distribution_id
        ORDER BY created_at, id
    LOOP
        v_layer_id := NULL;
        v_before := 0;
        v_received := COALESCE(v_item.received_quantity, v_item.quantity);

        SELECT id, current_quantity
        INTO v_layer_id, v_before
        FROM public.immunization_stock_layers
        WHERE owner_type = 'IPRESS'
          AND facility_code = v_batch.destination_facility_code
          AND product_id = v_item.product_id
          AND lote = v_item.lote
          AND expiration_date = v_item.expiration_date
          AND unit_price = v_item.unit_price
          AND funding_source = v_item.funding_source
          AND supply_type = v_item.supply_type
        LIMIT 1
        FOR UPDATE;

        v_after := COALESCE(v_before, 0) + v_received;

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
                'IPRESS',
                v_batch.unget_id,
                v_batch.destination_facility_code,
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
            'IPRESS_DISTRIBUTION_IN',
            'IPRESS',
            v_batch.unget_id,
            v_batch.destination_facility_code,
            v_item.product_id,
            v_layer_id,
            v_received,
            COALESCE(v_before, 0),
            v_after,
            v_batch.period,
            'Recepcion de distribucion UNGET',
            CONCAT_WS(' | ', NULLIF(v_batch.reference_document, ''), NULLIF(v_batch.observation, ''), NULLIF(p_observation, ''), NULLIF(v_item.observation, '')),
            p_received_by,
            now()
        )
        RETURNING id INTO v_movement_id;

        UPDATE public.immunization_stock_layers
        SET source_movement_id = COALESCE(source_movement_id, v_movement_id)
        WHERE id = v_layer_id;

        UPDATE public.immunization_distribution_items
        SET received_quantity = v_received,
            destination_stock_layer_id = v_layer_id
        WHERE id = v_item.id;
    END LOOP;

    UPDATE public.immunization_distribution_batches
    SET status = 'RECEIVED',
        received_by = p_received_by,
        received_at = now(),
        reception_observation = NULLIF(p_observation, ''),
        updated_at = now()
    WHERE id = p_distribution_id;

    RETURN p_distribution_id;
END;
$$;

ALTER TABLE public.immunization_distribution_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.immunization_distribution_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir todo temporalmente immunization_distribution_batches" ON public.immunization_distribution_batches;
CREATE POLICY "Permitir todo temporalmente immunization_distribution_batches"
ON public.immunization_distribution_batches
FOR ALL
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir todo temporalmente immunization_distribution_items" ON public.immunization_distribution_items;
CREATE POLICY "Permitir todo temporalmente immunization_distribution_items"
ON public.immunization_distribution_items
FOR ALL
USING (true)
WITH CHECK (true);

UPDATE public.roles_config
SET allowed_modules =
    CASE
        WHEN COALESCE(allowed_modules, '[]'::jsonb) ? 'IMMUNIZATION_DISTRIBUTIONS' THEN COALESCE(allowed_modules, '[]'::jsonb)
        ELSE COALESCE(allowed_modules, '[]'::jsonb) || '["IMMUNIZATION_DISTRIBUTIONS"]'::jsonb
    END
WHERE role IN ('ADMIN', 'INMU_UNGET', 'INMU_DIRESA', 'INMU_IPRESS');

NOTIFY pgrst, 'reload schema';
