-- SUPABASE_MIGRATION_IMMUNIZATION_REGIONAL_REFACTOR.sql
-- Fase 14: refactor regional de abastecimiento.
-- Habilita stock regional DIRESA, ingresos regionales y distribucion DIRESA -> UNGET -> IPRESS.
-- Ejecutar despues de:
--   SUPABASE_SCHEMA_IMMUNIZATIONS_V1.sql
--   SUPABASE_MIGRATION_IMMUNIZATION_INCOMES.sql
--   SUPABASE_MIGRATION_IMMUNIZATION_DISTRIBUTIONS.sql
--   SUPABASE_MIGRATION_IMMUNIZATION_RECEPTIONS.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Stock y movimientos con propietario DIRESA.
ALTER TABLE public.immunization_stock_layers
ADD COLUMN IF NOT EXISTS regional_warehouse_id TEXT;

ALTER TABLE public.immunization_stock_movements
ADD COLUMN IF NOT EXISTS regional_warehouse_id TEXT;

ALTER TABLE public.immunization_stock_layers
DROP CONSTRAINT IF EXISTS immunization_stock_layers_owner_type_check;

ALTER TABLE public.immunization_stock_layers
DROP CONSTRAINT IF EXISTS immunization_stock_owner_chk;

ALTER TABLE public.immunization_stock_layers
ADD CONSTRAINT immunization_stock_layers_owner_type_check
CHECK (owner_type IN ('DIRESA', 'UNGET', 'IPRESS'));

ALTER TABLE public.immunization_stock_layers
ADD CONSTRAINT immunization_stock_owner_chk
CHECK (
    (owner_type = 'DIRESA' AND regional_warehouse_id IS NOT NULL AND unget_id IS NULL AND facility_code IS NULL)
    OR
    (owner_type = 'UNGET' AND regional_warehouse_id IS NULL AND unget_id IS NOT NULL AND facility_code IS NULL)
    OR
    (owner_type = 'IPRESS' AND regional_warehouse_id IS NULL AND facility_code IS NOT NULL)
);

ALTER TABLE public.immunization_stock_movements
DROP CONSTRAINT IF EXISTS immunization_stock_movements_owner_type_check;

ALTER TABLE public.immunization_stock_movements
DROP CONSTRAINT IF EXISTS immunization_movements_owner_scope_chk;

ALTER TABLE public.immunization_stock_movements
ADD CONSTRAINT immunization_stock_movements_owner_type_check
CHECK (owner_type IN ('DIRESA', 'UNGET', 'IPRESS'));

ALTER TABLE public.immunization_stock_movements
ADD CONSTRAINT immunization_movements_owner_scope_chk
CHECK (
    (owner_type = 'DIRESA' AND regional_warehouse_id IS NOT NULL AND unget_id IS NULL AND facility_code IS NULL)
    OR
    (owner_type = 'UNGET' AND regional_warehouse_id IS NULL AND unget_id IS NOT NULL AND facility_code IS NULL)
    OR
    (owner_type = 'IPRESS' AND regional_warehouse_id IS NULL AND facility_code IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS immunization_stock_layers_regional_idx
ON public.immunization_stock_layers (regional_warehouse_id);

CREATE INDEX IF NOT EXISTS immunization_movements_regional_idx
ON public.immunization_stock_movements (regional_warehouse_id);

CREATE TABLE IF NOT EXISTS public.immunization_income_origins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by TEXT REFERENCES public.users(username) ON DELETE SET NULL,
    updated_by TEXT REFERENCES public.users(username) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS immunization_income_origins_active_idx
ON public.immunization_income_origins (is_active);

ALTER TABLE public.immunization_income_origins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir todo temporalmente immunization_income_origins" ON public.immunization_income_origins;
CREATE POLICY "Permitir todo temporalmente immunization_income_origins"
ON public.immunization_income_origins
FOR ALL
USING (true)
WITH CHECK (true);

INSERT INTO public.immunization_income_origins (name, is_active)
VALUES ('CENARES', true), ('OGESS', true)
ON CONFLICT (name) DO NOTHING;

-- 2. Ingresos: DIRESA puede registrar ingresos al almacen regional.
ALTER TABLE public.immunization_income_batches
ADD COLUMN IF NOT EXISTS regional_warehouse_id TEXT;

ALTER TABLE public.immunization_income_batches
ADD COLUMN IF NOT EXISTS income_date DATE;

ALTER TABLE public.immunization_income_batches
ALTER COLUMN unget_id DROP NOT NULL;

ALTER TABLE public.immunization_income_batches
DROP CONSTRAINT IF EXISTS immunization_income_batches_owner_type_check;

ALTER TABLE public.immunization_income_batches
DROP CONSTRAINT IF EXISTS immunization_income_batches_source_type_check;

ALTER TABLE public.immunization_income_batches
DROP CONSTRAINT IF EXISTS immunization_income_transfer_origin_chk;

ALTER TABLE public.immunization_income_batches
DROP CONSTRAINT IF EXISTS immunization_income_owner_scope_chk;

ALTER TABLE public.immunization_income_batches
ADD CONSTRAINT immunization_income_batches_owner_type_check
CHECK (owner_type IN ('DIRESA', 'UNGET'));

ALTER TABLE public.immunization_income_batches
ADD CONSTRAINT immunization_income_batches_source_type_check
CHECK (source_type IN ('CENARES', 'OGESS', 'REGIONAL_WAREHOUSE', 'UNGET_TRANSFER', 'OTHER'));

ALTER TABLE public.immunization_income_batches
ADD CONSTRAINT immunization_income_owner_scope_chk
CHECK (
    (owner_type = 'DIRESA' AND regional_warehouse_id IS NOT NULL AND unget_id IS NULL)
    OR
    (owner_type = 'UNGET' AND regional_warehouse_id IS NULL AND unget_id IS NOT NULL)
);

ALTER TABLE public.immunization_income_batches
ADD CONSTRAINT immunization_income_transfer_origin_chk
CHECK (
    source_type <> 'UNGET_TRANSFER'
    OR
    (source_unget_id IS NOT NULL AND (unget_id IS NULL OR source_unget_id <> unget_id))
);

CREATE INDEX IF NOT EXISTS immunization_income_batches_regional_idx
ON public.immunization_income_batches (regional_warehouse_id);

CREATE INDEX IF NOT EXISTS immunization_income_batches_income_date_idx
ON public.immunization_income_batches (income_date);

-- 3. Distribuciones: dos flujos en la misma estructura.
ALTER TABLE public.immunization_distribution_batches
ADD COLUMN IF NOT EXISTS flow_type TEXT NOT NULL DEFAULT 'UNGET_IPRESS';

ALTER TABLE public.immunization_distribution_batches
ADD COLUMN IF NOT EXISTS origin_owner_type TEXT NOT NULL DEFAULT 'UNGET';

ALTER TABLE public.immunization_distribution_batches
ADD COLUMN IF NOT EXISTS destination_owner_type TEXT NOT NULL DEFAULT 'IPRESS';

ALTER TABLE public.immunization_distribution_batches
ADD COLUMN IF NOT EXISTS regional_warehouse_id TEXT;

ALTER TABLE public.immunization_distribution_batches
ADD COLUMN IF NOT EXISTS origin_unget_id UUID REFERENCES public.ungets(id) ON DELETE CASCADE;

ALTER TABLE public.immunization_distribution_batches
ADD COLUMN IF NOT EXISTS destination_unget_id UUID REFERENCES public.ungets(id) ON DELETE CASCADE;

ALTER TABLE public.immunization_distribution_batches
ALTER COLUMN destination_facility_code DROP NOT NULL;

UPDATE public.immunization_distribution_batches
SET flow_type = COALESCE(flow_type, 'UNGET_IPRESS'),
    origin_owner_type = COALESCE(origin_owner_type, 'UNGET'),
    destination_owner_type = COALESCE(destination_owner_type, 'IPRESS'),
    origin_unget_id = COALESCE(origin_unget_id, unget_id)
WHERE destination_facility_code IS NOT NULL;

ALTER TABLE public.immunization_distribution_batches
DROP CONSTRAINT IF EXISTS immunization_distribution_batches_flow_chk;

ALTER TABLE public.immunization_distribution_batches
DROP CONSTRAINT IF EXISTS immunization_distribution_batches_origin_owner_chk;

ALTER TABLE public.immunization_distribution_batches
DROP CONSTRAINT IF EXISTS immunization_distribution_batches_destination_owner_chk;

ALTER TABLE public.immunization_distribution_batches
DROP CONSTRAINT IF EXISTS immunization_distribution_batches_route_chk;

ALTER TABLE public.immunization_distribution_batches
ADD CONSTRAINT immunization_distribution_batches_flow_chk
CHECK (flow_type IN ('DIRESA_UNGET', 'UNGET_IPRESS'));

ALTER TABLE public.immunization_distribution_batches
ADD CONSTRAINT immunization_distribution_batches_origin_owner_chk
CHECK (origin_owner_type IN ('DIRESA', 'UNGET'));

ALTER TABLE public.immunization_distribution_batches
ADD CONSTRAINT immunization_distribution_batches_destination_owner_chk
CHECK (destination_owner_type IN ('UNGET', 'IPRESS'));

ALTER TABLE public.immunization_distribution_batches
ADD CONSTRAINT immunization_distribution_batches_route_chk
CHECK (
    (
        flow_type = 'DIRESA_UNGET'
        AND origin_owner_type = 'DIRESA'
        AND destination_owner_type = 'UNGET'
        AND regional_warehouse_id IS NOT NULL
        AND destination_unget_id IS NOT NULL
        AND unget_id = destination_unget_id
        AND destination_facility_code IS NULL
        AND origin_unget_id IS NULL
    )
    OR
    (
        flow_type = 'UNGET_IPRESS'
        AND origin_owner_type = 'UNGET'
        AND destination_owner_type = 'IPRESS'
        AND origin_unget_id IS NOT NULL
        AND unget_id = origin_unget_id
        AND destination_facility_code IS NOT NULL
        AND destination_unget_id IS NULL
        AND regional_warehouse_id IS NULL
    )
);

CREATE INDEX IF NOT EXISTS immunization_distribution_batches_flow_idx
ON public.immunization_distribution_batches (flow_type);

CREATE INDEX IF NOT EXISTS immunization_distribution_batches_origin_unget_idx
ON public.immunization_distribution_batches (origin_unget_id);

CREATE INDEX IF NOT EXISTS immunization_distribution_batches_destination_unget_idx
ON public.immunization_distribution_batches (destination_unget_id);

CREATE INDEX IF NOT EXISTS immunization_distribution_batches_regional_idx
ON public.immunization_distribution_batches (regional_warehouse_id);

-- 4. RPC: aplicar ingresos regionales o UNGET.
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
    v_owner_type TEXT;
    v_regional_warehouse_id TEXT;
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

    v_owner_type := COALESCE(v_income.owner_type, 'UNGET');
    v_regional_warehouse_id := COALESCE(NULLIF(v_income.regional_warehouse_id, ''), 'DIRESA_SAN_MARTIN_REGIONAL');

    IF v_owner_type = 'DIRESA' AND v_regional_warehouse_id IS NULL THEN
        RAISE EXCEPTION 'REGIONAL_WAREHOUSE_REQUIRED';
    END IF;

    IF v_owner_type = 'UNGET' AND v_income.unget_id IS NULL THEN
        RAISE EXCEPTION 'UNGET_REQUIRED';
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
        WHERE owner_type = v_owner_type
          AND (v_owner_type <> 'DIRESA' OR regional_warehouse_id = v_regional_warehouse_id)
          AND (v_owner_type <> 'UNGET' OR unget_id = v_income.unget_id)
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
                regional_warehouse_id,
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
                v_owner_type,
                CASE WHEN v_owner_type = 'DIRESA' THEN v_regional_warehouse_id ELSE NULL END,
                CASE WHEN v_owner_type = 'UNGET' THEN v_income.unget_id ELSE NULL END,
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
            regional_warehouse_id,
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
            CASE WHEN v_owner_type = 'DIRESA' THEN 'DIRESA_INCOME' ELSE 'UNGET_INCOME' END,
            v_owner_type,
            CASE WHEN v_owner_type = 'DIRESA' THEN v_regional_warehouse_id ELSE NULL END,
            CASE WHEN v_owner_type = 'UNGET' THEN v_income.unget_id ELSE NULL END,
            NULL,
            v_item.product_id,
            v_layer_id,
            v_item.quantity,
            COALESCE(v_before, 0),
            v_after,
            v_income.period,
            CASE
                WHEN v_owner_type = 'DIRESA' AND v_income.source_type = 'CENARES' THEN 'Ingreso regional desde CENARES'
                WHEN v_owner_type = 'DIRESA' AND v_income.source_type = 'UNGET_TRANSFER' THEN 'Ingreso regional por transferencia UNGET'
                WHEN v_owner_type = 'DIRESA' THEN 'Ingreso regional'
                WHEN v_income.source_type = 'OGESS' THEN 'Ingreso desde OGESS'
                WHEN v_income.source_type = 'UNGET_TRANSFER' THEN 'Ingreso por transferencia de otra UNGET'
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

-- 5. RPC: enviar distribucion desde DIRESA o UNGET.
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
    v_destination_unget_id UUID;
    v_origin_unget_id UUID;
    v_flow_type TEXT;
    v_origin_owner_type TEXT;
    v_regional_warehouse_id TEXT;
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

    v_flow_type := COALESCE(v_batch.flow_type, 'UNGET_IPRESS');
    v_origin_owner_type := COALESCE(v_batch.origin_owner_type, CASE WHEN v_flow_type = 'DIRESA_UNGET' THEN 'DIRESA' ELSE 'UNGET' END);
    v_origin_unget_id := COALESCE(v_batch.origin_unget_id, CASE WHEN v_flow_type = 'UNGET_IPRESS' THEN v_batch.unget_id ELSE NULL END);
    v_destination_unget_id := COALESCE(v_batch.destination_unget_id, CASE WHEN v_flow_type = 'DIRESA_UNGET' THEN v_batch.unget_id ELSE NULL END);
    v_regional_warehouse_id := COALESCE(NULLIF(v_batch.regional_warehouse_id, ''), 'DIRESA_SAN_MARTIN_REGIONAL');

    IF v_flow_type = 'DIRESA_UNGET' THEN
        IF v_origin_owner_type <> 'DIRESA' OR v_destination_unget_id IS NULL THEN
            RAISE EXCEPTION 'INVALID_REGIONAL_DISTRIBUTION';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM public.ungets WHERE id = v_destination_unget_id) THEN
            RAISE EXCEPTION 'DESTINATION_UNGET_NOT_FOUND';
        END IF;
    ELSE
        IF v_origin_owner_type <> 'UNGET' OR v_origin_unget_id IS NULL OR v_batch.destination_facility_code IS NULL THEN
            RAISE EXCEPTION 'INVALID_UNGET_DISTRIBUTION';
        END IF;

        SELECT unget_id
        INTO v_facility_unget
        FROM public.facilities
        WHERE code = v_batch.destination_facility_code;

        IF v_facility_unget IS DISTINCT FROM v_origin_unget_id THEN
            RAISE EXCEPTION 'DESTINATION_OUT_OF_UNGET';
        END IF;
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
          AND owner_type = v_origin_owner_type
          AND (v_origin_owner_type <> 'DIRESA' OR regional_warehouse_id = v_regional_warehouse_id)
          AND (v_origin_owner_type <> 'UNGET' OR unget_id = v_origin_unget_id)
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
            regional_warehouse_id,
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
            CASE WHEN v_flow_type = 'DIRESA_UNGET' THEN 'DIRESA_DISTRIBUTION_OUT' ELSE 'UNGET_DISTRIBUTION_OUT' END,
            v_origin_owner_type,
            CASE WHEN v_flow_type = 'DIRESA_UNGET' THEN v_regional_warehouse_id ELSE NULL END,
            CASE WHEN v_flow_type = 'UNGET_IPRESS' THEN v_origin_unget_id ELSE NULL END,
            NULL,
            v_item.product_id,
            v_item.source_stock_layer_id,
            -v_item.quantity,
            v_before,
            v_after,
            v_batch.period,
            CASE WHEN v_flow_type = 'DIRESA_UNGET' THEN 'Distribucion regional a UNGET pendiente de recepcion' ELSE 'Distribucion a IPRESS pendiente de recepcion' END,
            CONCAT_WS(' | ', COALESCE(v_destination_unget_id::text, v_batch.destination_facility_code), NULLIF(v_batch.reference_document, ''), NULLIF(v_batch.observation, ''), NULLIF(v_item.observation, '')),
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

-- 6. RPC: recepcionar distribucion en UNGET o IPRESS con incidencias por item.
DROP FUNCTION IF EXISTS public.receive_immunization_distribution(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.receive_immunization_distribution(UUID, TEXT, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.receive_immunization_distribution(
    p_distribution_id UUID,
    p_received_by TEXT DEFAULT NULL,
    p_reception_reason TEXT DEFAULT NULL,
    p_reception_observation TEXT DEFAULT NULL,
    p_items JSONB DEFAULT '[]'::jsonb
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
    v_has_difference BOOLEAN := false;
    v_observed BOOLEAN := false;
    v_flow_type TEXT;
    v_destination_owner_type TEXT;
    v_destination_unget_id UUID;
    v_origin_unget_id UUID;
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

    v_flow_type := COALESCE(v_batch.flow_type, 'UNGET_IPRESS');
    v_destination_owner_type := COALESCE(v_batch.destination_owner_type, CASE WHEN v_flow_type = 'DIRESA_UNGET' THEN 'UNGET' ELSE 'IPRESS' END);
    v_destination_unget_id := COALESCE(v_batch.destination_unget_id, CASE WHEN v_flow_type = 'DIRESA_UNGET' THEN v_batch.unget_id ELSE NULL END);
    v_origin_unget_id := COALESCE(v_batch.origin_unget_id, CASE WHEN v_flow_type = 'UNGET_IPRESS' THEN v_batch.unget_id ELSE NULL END);

    IF v_flow_type = 'DIRESA_UNGET' AND (v_destination_owner_type <> 'UNGET' OR v_destination_unget_id IS NULL) THEN
        RAISE EXCEPTION 'INVALID_REGIONAL_RECEPTION';
    END IF;

    IF v_flow_type = 'UNGET_IPRESS' AND (v_destination_owner_type <> 'IPRESS' OR v_origin_unget_id IS NULL OR v_batch.destination_facility_code IS NULL) THEN
        RAISE EXCEPTION 'INVALID_IPRESS_RECEPTION';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.immunization_distribution_items
        WHERE distribution_id = p_distribution_id
    ) THEN
        RAISE EXCEPTION 'RECEPTION_WITHOUT_ITEMS';
    END IF;

    FOR v_item IN
        SELECT *
        FROM public.immunization_distribution_items
        WHERE distribution_id = p_distribution_id
        ORDER BY created_at, id
    LOOP
        SELECT COALESCE((entry->>'received_quantity')::numeric, v_item.quantity)
        INTO v_received
        FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) entry
        WHERE entry->>'item_id' = v_item.id::text
        LIMIT 1;

        v_received := COALESCE(v_received, v_item.quantity);

        IF v_received < 0 THEN
            RAISE EXCEPTION 'RECEPTION_NEGATIVE_QUANTITY';
        END IF;

        IF v_received <> v_item.quantity THEN
            v_has_difference := true;
        END IF;
    END LOOP;

    IF v_has_difference AND NULLIF(BTRIM(COALESCE(p_reception_reason, '')), '') IS NULL THEN
        RAISE EXCEPTION 'OBSERVED_RECEPTION_REQUIRES_REASON';
    END IF;

    IF (v_has_difference OR NULLIF(BTRIM(COALESCE(p_reception_reason, '')), '') IS NOT NULL)
       AND NULLIF(BTRIM(COALESCE(p_reception_observation, '')), '') IS NULL THEN
        RAISE EXCEPTION 'OBSERVED_RECEPTION_REQUIRES_OBSERVATION';
    END IF;

    v_observed := v_has_difference OR NULLIF(BTRIM(COALESCE(p_reception_reason, '')), '') IS NOT NULL;

    FOR v_item IN
        SELECT *
        FROM public.immunization_distribution_items
        WHERE distribution_id = p_distribution_id
        ORDER BY created_at, id
    LOOP
        SELECT COALESCE((entry->>'received_quantity')::numeric, v_item.quantity)
        INTO v_received
        FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) entry
        WHERE entry->>'item_id' = v_item.id::text
        LIMIT 1;

        v_received := COALESCE(v_received, v_item.quantity);

        IF v_received < 0 THEN
            RAISE EXCEPTION 'RECEPTION_NEGATIVE_QUANTITY';
        END IF;

        IF v_received = 0 THEN
            UPDATE public.immunization_distribution_items
            SET received_quantity = 0,
                destination_stock_layer_id = NULL
            WHERE id = v_item.id;
            CONTINUE;
        END IF;

        v_layer_id := NULL;
        v_before := 0;

        SELECT id, current_quantity
        INTO v_layer_id, v_before
        FROM public.immunization_stock_layers
        WHERE owner_type = v_destination_owner_type
          AND (v_destination_owner_type <> 'UNGET' OR unget_id = v_destination_unget_id)
          AND (v_destination_owner_type <> 'IPRESS' OR facility_code = v_batch.destination_facility_code)
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
                regional_warehouse_id,
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
                v_destination_owner_type,
                NULL,
                CASE WHEN v_destination_owner_type = 'UNGET' THEN v_destination_unget_id ELSE v_origin_unget_id END,
                CASE WHEN v_destination_owner_type = 'IPRESS' THEN v_batch.destination_facility_code ELSE NULL END,
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
            regional_warehouse_id,
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
            CASE WHEN v_flow_type = 'DIRESA_UNGET' THEN 'UNGET_DISTRIBUTION_IN' ELSE 'IPRESS_DISTRIBUTION_IN' END,
            v_destination_owner_type,
            NULL,
            CASE WHEN v_destination_owner_type = 'UNGET' THEN v_destination_unget_id ELSE v_origin_unget_id END,
            CASE WHEN v_destination_owner_type = 'IPRESS' THEN v_batch.destination_facility_code ELSE NULL END,
            v_item.product_id,
            v_layer_id,
            v_received,
            COALESCE(v_before, 0),
            v_after,
            v_batch.period,
            CASE
                WHEN v_observed AND v_flow_type = 'DIRESA_UNGET' THEN 'Recepcion observada de distribucion DIRESA'
                WHEN v_observed THEN 'Recepcion observada de distribucion UNGET'
                WHEN v_flow_type = 'DIRESA_UNGET' THEN 'Recepcion conforme de distribucion DIRESA'
                ELSE 'Recepcion conforme de distribucion UNGET'
            END,
            CONCAT_WS(' | ', NULLIF(v_batch.reference_document, ''), NULLIF(v_batch.observation, ''), NULLIF(p_reception_reason, ''), NULLIF(p_reception_observation, ''), NULLIF(v_item.observation, '')),
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
    SET status = CASE WHEN v_observed THEN 'OBSERVED' ELSE 'RECEIVED' END,
        received_by = p_received_by,
        received_at = now(),
        reception_reason = NULLIF(BTRIM(COALESCE(p_reception_reason, '')), ''),
        reception_observation = NULLIF(BTRIM(COALESCE(p_reception_observation, '')), ''),
        updated_at = now()
    WHERE id = p_distribution_id;

    RETURN p_distribution_id;
END;
$$;

UPDATE public.roles_config
SET allowed_modules =
    CASE
        WHEN COALESCE(allowed_modules, '[]'::jsonb) ? 'IMMUNIZATION_INCOMES' THEN COALESCE(allowed_modules, '[]'::jsonb)
        ELSE COALESCE(allowed_modules, '[]'::jsonb) || '["IMMUNIZATION_INCOMES"]'::jsonb
    END
WHERE role IN ('ADMIN', 'INMU_DIRESA');

UPDATE public.roles_config
SET allowed_modules =
    CASE
        WHEN COALESCE(allowed_modules, '[]'::jsonb) ? 'IMMUNIZATION_INCOME_ORIGINS' THEN COALESCE(allowed_modules, '[]'::jsonb)
        ELSE COALESCE(allowed_modules, '[]'::jsonb) || '["IMMUNIZATION_INCOME_ORIGINS"]'::jsonb
    END
WHERE role IN ('ADMIN', 'INMU_DIRESA');

UPDATE public.roles_config
SET allowed_modules =
    CASE
        WHEN COALESCE(allowed_modules, '[]'::jsonb) ? 'IMMUNIZATION_DISTRIBUTIONS' THEN COALESCE(allowed_modules, '[]'::jsonb)
        ELSE COALESCE(allowed_modules, '[]'::jsonb) || '["IMMUNIZATION_DISTRIBUTIONS"]'::jsonb
    END
WHERE role IN ('ADMIN', 'INMU_DIRESA', 'INMU_UNGET', 'INMU_IPRESS');

NOTIFY pgrst, 'reload schema';
