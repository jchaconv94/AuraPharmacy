-- SUPABASE_MIGRATION_IMMUNIZATION_RECEPTIONS.sql
-- Etapa 2 / Fase 13: recepcion IPRESS con incidencias por item.
-- Ejecutar despues de SUPABASE_MIGRATION_IMMUNIZATION_DISTRIBUTIONS.sql.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'immunization_distribution_items_received_quantity_chk'
    ) THEN
        ALTER TABLE public.immunization_distribution_items
        ADD CONSTRAINT immunization_distribution_items_received_quantity_chk
        CHECK (received_quantity IS NULL OR received_quantity >= 0);
    END IF;
END $$;

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
            CASE WHEN v_observed THEN 'Recepcion observada de distribucion UNGET' ELSE 'Recepcion conforme de distribucion UNGET' END,
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

NOTIFY pgrst, 'reload schema';
