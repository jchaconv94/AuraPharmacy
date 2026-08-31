-- SUPABASE_MIGRATION_IMMUNIZATION_INITIAL_PROVISION.sql
-- Habilita soporte para "Remesa Inicial" de apertura de IPRESS nuevas o sin inventario previo.
-- Permite que una UNGET distribuya a una IPRESS marcando is_initial_provision = true,
-- y que al momento de la recepción, se aperture y cierre automáticamente el inventario inicial
-- de dicha IPRESS con los biológicos recibidos, habilitándola para operar de inmediato.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Agregar columnas a tablas de inventario inicial y distribuciones
ALTER TABLE public.immunization_initial_inventories
ADD COLUMN IF NOT EXISTS is_initial_provision BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.immunization_initial_inventories
DROP CONSTRAINT IF EXISTS immunization_initial_inventories_source_type_check;

ALTER TABLE public.immunization_initial_inventories
ADD CONSTRAINT immunization_initial_inventories_source_type_check
CHECK (source_type IN ('MANUAL', 'EXCEL', 'MIXED', 'INITIAL_PROVISION'));

ALTER TABLE public.immunization_distribution_batches
ADD COLUMN IF NOT EXISTS is_initial_provision BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS immunization_dist_initial_prov_idx
ON public.immunization_distribution_batches (is_initial_provision)
WHERE is_initial_provision = true;

-- 2. Actualizar función RPC receive_immunization_distribution para auto-crear y cerrar el inventario inicial si es remesa inicial
CREATE OR REPLACE FUNCTION public.receive_immunization_distribution(
    p_distribution_id UUID,
    p_received_by TEXT DEFAULT NULL,
    p_reception_reason TEXT DEFAULT NULL,
    p_reception_observation TEXT DEFAULT NULL,
    p_items JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_batch public.immunization_distribution_batches%ROWTYPE;
    v_item public.immunization_distribution_items%ROWTYPE;
    v_received NUMERIC;
    v_layer_id UUID;
    v_movement_id UUID;
    v_before NUMERIC;
    v_after NUMERIC;
    v_has_difference BOOLEAN := false;
    v_observed BOOLEAN := false;
    v_flow_type TEXT;
    v_destination_owner_type TEXT;
    v_destination_unget_id UUID;
    v_origin_unget_id UUID;
    v_inv_id UUID;
    v_inv_exists BOOLEAN := false;
    v_product_sismed TEXT;
    v_product_desc TEXT;
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

    -- Validar si la IPRESS de destino ya cuenta con inventario inicial cerrado cuando NO es remesa inicial
    IF v_destination_owner_type = 'IPRESS' AND COALESCE(v_batch.is_initial_provision, false) = false THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.immunization_initial_inventories
            WHERE owner_type = 'IPRESS'
              AND facility_code = v_batch.destination_facility_code
              AND status = 'CLOSED'
        ) INTO v_inv_exists;

        IF NOT v_inv_exists THEN
            RAISE EXCEPTION 'IPRESS_NOT_INITIALIZED';
        END IF;
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

    -- Si es remesa inicial para IPRESS, preparamos la creación del inventario inicial cerrado
    IF v_destination_owner_type = 'IPRESS' AND COALESCE(v_batch.is_initial_provision, false) = true THEN
        SELECT id
        INTO v_inv_id
        FROM public.immunization_initial_inventories
        WHERE owner_type = 'IPRESS'
          AND facility_code = v_batch.destination_facility_code
        ORDER BY created_at DESC
        LIMIT 1;

        IF v_inv_id IS NULL THEN
            INSERT INTO public.immunization_initial_inventories (
                owner_type,
                unget_id,
                facility_code,
                period,
                status,
                source_type,
                is_initial_provision,
                created_by,
                closed_by,
                closed_at,
                created_at,
                updated_at
            ) VALUES (
                'IPRESS',
                v_origin_unget_id,
                v_batch.destination_facility_code,
                v_batch.period,
                'CLOSED',
                'INITIAL_PROVISION',
                true,
                COALESCE(p_received_by, 'Sistema (Remesa Inicial)'),
                COALESCE(p_received_by, 'Sistema (Remesa Inicial)'),
                now(),
                now(),
                now()
            )
            RETURNING id INTO v_inv_id;
        ELSE
            UPDATE public.immunization_initial_inventories
            SET status = 'CLOSED',
                source_type = 'INITIAL_PROVISION',
                is_initial_provision = true,
                closed_by = COALESCE(p_received_by, 'Sistema (Remesa Inicial)'),
                closed_at = now(),
                updated_at = now()
            WHERE id = v_inv_id;
        END IF;
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
                WHEN COALESCE(v_batch.is_initial_provision, false) = true THEN 'Recepción de Remesa Inicial de apertura'
                WHEN v_observed AND v_flow_type = 'DIRESA_UNGET' THEN 'Recepción observada de distribución DIRESA'
                WHEN v_observed THEN 'Recepción observada de distribución UNGET'
                WHEN v_flow_type = 'DIRESA_UNGET' THEN 'Recepción conforme de distribución DIRESA'
                ELSE 'Recepción conforme de distribución UNGET'
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

        -- Si es remesa inicial para IPRESS, insertar ítem en inventario inicial
        IF v_inv_id IS NOT NULL THEN
            SELECT codigo_sismed, descripcion
            INTO v_product_sismed, v_product_desc
            FROM public.immunization_products
            WHERE id = v_item.product_id;

            INSERT INTO public.immunization_initial_inventory_items (
                inventory_id,
                product_id,
                codigo_sismed_snapshot,
                excel_description_snapshot,
                lote,
                expiration_date,
                quantity,
                unit_price,
                funding_source,
                supply_type,
                observation,
                created_at
            ) VALUES (
                v_inv_id,
                v_item.product_id,
                COALESCE(v_product_sismed, v_item.codigo_sismed_snapshot),
                COALESCE(v_product_desc, v_item.codigo_sismed_snapshot),
                v_item.lote,
                v_item.expiration_date,
                v_received,
                v_item.unit_price,
                v_item.funding_source,
                v_item.supply_type,
                'Apertura por remesa inicial',
                now()
            );
        END IF;
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
