-- Fase 8: aplicacion atomica de reajustes de stock de inmunizaciones.
-- Ejecutar despues de SUPABASE_SCHEMA_IMMUNIZATIONS_V1.sql.

ALTER TABLE public.immunization_adjustment_items
ADD COLUMN IF NOT EXISTS operation_type TEXT NOT NULL DEFAULT 'QUANTITY';

ALTER TABLE public.immunization_adjustment_items
ADD COLUMN IF NOT EXISTS reclassification_key UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'immunization_adjustment_items_operation_type_chk'
          AND conrelid = 'public.immunization_adjustment_items'::regclass
    ) THEN
        ALTER TABLE public.immunization_adjustment_items
        ADD CONSTRAINT immunization_adjustment_items_operation_type_chk
        CHECK (operation_type IN ('QUANTITY', 'NEW_LAYER', 'RECLASSIFY_SOURCE', 'RECLASSIFY_TARGET'));
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS immunization_adjustment_items_reclassification_idx
ON public.immunization_adjustment_items (reclassification_key)
WHERE reclassification_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.apply_immunization_stock_adjustment(
    p_owner_type TEXT,
    p_unget_id UUID,
    p_facility_code TEXT,
    p_period TEXT,
    p_reason TEXT,
    p_observation TEXT,
    p_created_by TEXT,
    p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_adjustment_id UUID;
    v_item JSONB;
    v_layer_id UUID;
    v_product_id UUID;
    v_before NUMERIC;
    v_reported_system NUMERIC;
    v_physical NUMERIC;
    v_difference NUMERIC;
    v_applied_count INTEGER := 0;
BEGIN
    IF p_owner_type NOT IN ('UNGET', 'IPRESS') THEN
        RAISE EXCEPTION 'INVALID_OWNER_TYPE';
    END IF;
    IF p_owner_type = 'UNGET' AND (p_unget_id IS NULL OR p_facility_code IS NOT NULL) THEN
        RAISE EXCEPTION 'INVALID_UNGET_SCOPE';
    END IF;
    IF p_owner_type = 'IPRESS' AND p_facility_code IS NULL THEN
        RAISE EXCEPTION 'INVALID_IPRESS_SCOPE';
    END IF;
    IF COALESCE(BTRIM(p_reason), '') = '' OR COALESCE(BTRIM(p_observation), '') = '' THEN
        RAISE EXCEPTION 'REASON_AND_OBSERVATION_REQUIRED';
    END IF;
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'ADJUSTMENT_ITEMS_REQUIRED';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM (
            SELECT
                item->>'reclassification_key' AS pair_key,
                COUNT(*) AS item_count,
                COUNT(*) FILTER (WHERE item->>'operation_type' = 'RECLASSIFY_SOURCE') AS source_count,
                COUNT(*) FILTER (WHERE item->>'operation_type' = 'RECLASSIFY_TARGET') AS target_count
            FROM jsonb_array_elements(p_items) AS entry(item)
            WHERE COALESCE(item->>'operation_type', 'QUANTITY') IN ('RECLASSIFY_SOURCE', 'RECLASSIFY_TARGET')
            GROUP BY item->>'reclassification_key'
        ) AS pairs
        WHERE pair_key IS NULL OR pair_key = '' OR item_count <> 2 OR source_count <> 1 OR target_count <> 1
    ) THEN
        RAISE EXCEPTION 'INVALID_RECLASSIFICATION_PAIR';
    END IF;

    INSERT INTO public.immunization_adjustments (
        owner_type, unget_id, facility_code, period, status, reason, observation, created_by
    ) VALUES (
        p_owner_type,
        CASE WHEN p_owner_type = 'UNGET' THEN p_unget_id ELSE NULL END,
        CASE WHEN p_owner_type = 'IPRESS' THEN p_facility_code ELSE NULL END,
        p_period,
        'APPLIED',
        BTRIM(p_reason),
        BTRIM(p_observation),
        p_created_by
    ) RETURNING id INTO v_adjustment_id;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_layer_id := NULLIF(v_item->>'stock_layer_id', '')::UUID;
        v_reported_system := COALESCE((v_item->>'system_quantity')::NUMERIC, 0);
        v_physical := (v_item->>'physical_quantity')::NUMERIC;

        IF COALESCE(v_item->>'operation_type', 'QUANTITY') NOT IN ('QUANTITY', 'NEW_LAYER', 'RECLASSIFY_SOURCE', 'RECLASSIFY_TARGET') THEN
            RAISE EXCEPTION 'INVALID_OPERATION_TYPE';
        END IF;
        IF v_item->>'operation_type' = 'RECLASSIFY_SOURCE' AND v_layer_id IS NULL THEN
            RAISE EXCEPTION 'RECLASSIFICATION_SOURCE_LAYER_REQUIRED';
        END IF;

        IF v_physical < 0 THEN
            RAISE EXCEPTION 'PHYSICAL_STOCK_CANNOT_BE_NEGATIVE';
        END IF;

        IF v_layer_id IS NOT NULL THEN
            SELECT stock.id, stock.current_quantity
            INTO v_layer_id, v_before
            FROM public.immunization_stock_layers AS stock
            WHERE stock.id = v_layer_id
              AND stock.owner_type = p_owner_type
              AND (p_owner_type <> 'UNGET' OR stock.unget_id = p_unget_id)
              AND (p_owner_type <> 'IPRESS' OR stock.facility_code = p_facility_code)
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'STOCK_LAYER_NOT_FOUND_OR_OUT_OF_SCOPE';
            END IF;
        ELSE
            SELECT stock.id, stock.current_quantity
            INTO v_layer_id, v_before
            FROM public.immunization_stock_layers AS stock
            WHERE stock.owner_type = p_owner_type
              AND (p_owner_type <> 'UNGET' OR stock.unget_id = p_unget_id)
              AND (p_owner_type <> 'IPRESS' OR stock.facility_code = p_facility_code)
              AND stock.product_id = v_product_id
              AND stock.lote = BTRIM(v_item->>'lote')
              AND stock.expiration_date = (v_item->>'expiration_date')::DATE
              AND stock.unit_price = (v_item->>'unit_price')::NUMERIC
              AND stock.funding_source = BTRIM(v_item->>'funding_source')
              AND stock.supply_type = BTRIM(v_item->>'supply_type')
            ORDER BY stock.created_at
            LIMIT 1
            FOR UPDATE;

            IF NOT FOUND THEN
                INSERT INTO public.immunization_stock_layers (
                    owner_type, unget_id, facility_code, product_id, lote, expiration_date,
                    unit_price, funding_source, supply_type, current_quantity, is_active
                ) VALUES (
                    p_owner_type,
                    CASE WHEN p_owner_type = 'UNGET' THEN p_unget_id ELSE NULL END,
                    CASE WHEN p_owner_type = 'IPRESS' THEN p_facility_code ELSE NULL END,
                    v_product_id,
                    BTRIM(v_item->>'lote'),
                    (v_item->>'expiration_date')::DATE,
                    (v_item->>'unit_price')::NUMERIC,
                    BTRIM(v_item->>'funding_source'),
                    BTRIM(v_item->>'supply_type'),
                    0,
                    false
                ) RETURNING id, current_quantity INTO v_layer_id, v_before;
            END IF;
        END IF;

        IF ABS(v_before - v_reported_system) > 0.000001 THEN
            RAISE EXCEPTION 'STOCK_CHANGED: expected %, current %', v_reported_system, v_before;
        END IF;

        v_difference := v_physical - v_before;
        IF v_difference = 0 THEN
            CONTINUE;
        END IF;

        UPDATE public.immunization_stock_layers
        SET current_quantity = v_physical,
            is_active = (v_physical > 0),
            updated_at = now()
        WHERE id = v_layer_id;

        INSERT INTO public.immunization_adjustment_items (
            adjustment_id, product_id, stock_layer_id, lote, expiration_date,
            system_quantity, physical_quantity, difference_quantity, unit_price,
            funding_source, supply_type, operation_type, reclassification_key
        ) VALUES (
            v_adjustment_id, v_product_id, v_layer_id, BTRIM(v_item->>'lote'),
            (v_item->>'expiration_date')::DATE, v_before, v_physical, v_difference,
            (v_item->>'unit_price')::NUMERIC, BTRIM(v_item->>'funding_source'),
            BTRIM(v_item->>'supply_type'), COALESCE(v_item->>'operation_type', 'QUANTITY'),
            NULLIF(v_item->>'reclassification_key', '')::UUID
        );

        INSERT INTO public.immunization_stock_movements (
            movement_type, owner_type, unget_id, facility_code, product_id,
            stock_layer_id, quantity_delta, quantity_before, quantity_after,
            period, reason, observation, created_by
        ) VALUES (
            'STOCK_ADJUSTMENT', p_owner_type,
            CASE WHEN p_owner_type = 'UNGET' THEN p_unget_id ELSE NULL END,
            CASE WHEN p_owner_type = 'IPRESS' THEN p_facility_code ELSE NULL END,
            v_product_id, v_layer_id, v_difference, v_before, v_physical,
            p_period, BTRIM(p_reason), BTRIM(p_observation), p_created_by
        );

        v_applied_count := v_applied_count + 1;
    END LOOP;

    IF v_applied_count = 0 THEN
        RAISE EXCEPTION 'NO_STOCK_DIFFERENCES';
    END IF;

    RETURN v_adjustment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_immunization_stock_adjustment(
    TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB
) TO anon, authenticated;
