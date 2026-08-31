-- SUPABASE_MIGRATION_FACILITIES_CASCADE_UPDATE.sql
-- Permite actualizar el código RENIPRESS de un establecimiento (facilities.code)
-- propagando automáticamente el cambio en cascada (ON UPDATE CASCADE) a todas las tablas hijas.

DO $$
DECLARE
    r RECORD;
BEGIN
    -- 1. Actualizar dinámicamente cualquier llave foránea existente que apunte a facilities(code)
    -- para que tenga ON UPDATE CASCADE
    FOR r IN (
        SELECT 
            tc.table_schema, 
            tc.table_name, 
            tc.constraint_name,
            kcu.column_name,
            rc.delete_rule
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        JOIN information_schema.referential_constraints AS rc
            ON rc.constraint_name = tc.constraint_name
            AND rc.constraint_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = 'facilities'
          AND ccu.column_name = 'code'
    ) LOOP
        EXECUTE format(
            'ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I;',
            r.table_schema,
            r.table_name,
            r.constraint_name
        );

        EXECUTE format(
            'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.facilities(code) ON UPDATE CASCADE ON DELETE %s;',
            r.table_schema,
            r.table_name,
            r.constraint_name,
            r.column_name,
            CASE WHEN r.delete_rule = 'CASCADE' THEN 'CASCADE' ELSE 'SET NULL' END
        );
    END LOOP;
END $$;

-- 2. Asegurar explícitamente las tablas conocidas en caso de que alguna llave foránea no estuviera creada o tuviera otro nombre
-- personnel
ALTER TABLE public.personnel DROP CONSTRAINT IF EXISTS personnel_facility_code_fkey;
ALTER TABLE public.personnel ADD CONSTRAINT personnel_facility_code_fkey 
    FOREIGN KEY (facility_code) REFERENCES public.facilities(code) ON UPDATE CASCADE ON DELETE SET NULL;

-- facility_warehouses
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'facility_warehouses') THEN
        ALTER TABLE public.facility_warehouses DROP CONSTRAINT IF EXISTS facility_warehouses_facility_code_fkey;
        ALTER TABLE public.facility_warehouses ADD CONSTRAINT facility_warehouses_facility_code_fkey 
            FOREIGN KEY (facility_code) REFERENCES public.facilities(code) ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END $$;

-- sync_installations
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sync_installations') THEN
        ALTER TABLE public.sync_installations DROP CONSTRAINT IF EXISTS sync_installations_facility_code_fkey;
        ALTER TABLE public.sync_installations ADD CONSTRAINT sync_installations_facility_code_fkey 
            FOREIGN KEY (facility_code) REFERENCES public.facilities(code) ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END $$;

-- stock_actual
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stock_actual') THEN
        ALTER TABLE public.stock_actual DROP CONSTRAINT IF EXISTS stock_actual_facility_code_fkey;
        ALTER TABLE public.stock_actual ADD CONSTRAINT stock_actual_facility_code_fkey 
            FOREIGN KEY (facility_code) REFERENCES public.facilities(code) ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END $$;

-- stock_assignments
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stock_assignments') THEN
        ALTER TABLE public.stock_assignments DROP CONSTRAINT IF EXISTS stock_assignments_facility_code_fkey;
        -- Solo agregar si existe la columna facility_code
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'stock_assignments' AND column_name = 'facility_code') THEN
            ALTER TABLE public.stock_assignments ADD CONSTRAINT stock_assignments_facility_code_fkey 
                FOREIGN KEY (facility_code) REFERENCES public.facilities(code) ON UPDATE CASCADE ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- immunization_initial_inventories
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'immunization_initial_inventories') THEN
        ALTER TABLE public.immunization_initial_inventories DROP CONSTRAINT IF EXISTS immunization_initial_inventories_facility_code_fkey;
        ALTER TABLE public.immunization_initial_inventories ADD CONSTRAINT immunization_initial_inventories_facility_code_fkey 
            FOREIGN KEY (facility_code) REFERENCES public.facilities(code) ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END $$;

-- immunization_stock_layers
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'immunization_stock_layers') THEN
        ALTER TABLE public.immunization_stock_layers DROP CONSTRAINT IF EXISTS immunization_stock_layers_facility_code_fkey;
        ALTER TABLE public.immunization_stock_layers ADD CONSTRAINT immunization_stock_layers_facility_code_fkey 
            FOREIGN KEY (facility_code) REFERENCES public.facilities(code) ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END $$;

-- immunization_stock_movements
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'immunization_stock_movements') THEN
        ALTER TABLE public.immunization_stock_movements DROP CONSTRAINT IF EXISTS immunization_stock_movements_facility_code_fkey;
        ALTER TABLE public.immunization_stock_movements ADD CONSTRAINT immunization_stock_movements_facility_code_fkey 
            FOREIGN KEY (facility_code) REFERENCES public.facilities(code) ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END $$;

-- immunization_adjustments
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'immunization_adjustments') THEN
        ALTER TABLE public.immunization_adjustments DROP CONSTRAINT IF EXISTS immunization_adjustments_facility_code_fkey;
        ALTER TABLE public.immunization_adjustments ADD CONSTRAINT immunization_adjustments_facility_code_fkey 
            FOREIGN KEY (facility_code) REFERENCES public.facilities(code) ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END $$;

-- immunization_distribution_batches
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'immunization_distribution_batches') THEN
        ALTER TABLE public.immunization_distribution_batches DROP CONSTRAINT IF EXISTS immunization_distribution_batches_destination_facility_code_fkey;
        ALTER TABLE public.immunization_distribution_batches ADD CONSTRAINT immunization_distribution_batches_destination_facility_code_fkey 
            FOREIGN KEY (destination_facility_code) REFERENCES public.facilities(code) ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END $$;

-- immunization_monthly_closures
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'immunization_monthly_closures') THEN
        ALTER TABLE public.immunization_monthly_closures DROP CONSTRAINT IF EXISTS immunization_monthly_closures_facility_code_fkey;
        ALTER TABLE public.immunization_monthly_closures ADD CONSTRAINT immunization_monthly_closures_facility_code_fkey 
            FOREIGN KEY (facility_code) REFERENCES public.facilities(code) ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END $$;

-- users (si tuviera facility_code)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'facility_code') THEN
        ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_facility_code_fkey;
        ALTER TABLE public.users ADD CONSTRAINT users_facility_code_fkey 
            FOREIGN KEY (facility_code) REFERENCES public.facilities(code) ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Función RPC para actualizar código y datos de IPRESS de forma segura
CREATE OR REPLACE FUNCTION public.update_health_facility(
    p_original_code TEXT,
    p_new_code TEXT,
    p_name TEXT,
    p_category TEXT,
    p_type TEXT DEFAULT NULL,
    p_unget_id UUID DEFAULT NULL,
    p_microred_id UUID DEFAULT NULL,
    p_ogess_id UUID DEFAULT NULL,
    p_diresa_id UUID DEFAULT NULL,
    p_legal_address TEXT DEFAULT NULL,
    p_website TEXT DEFAULT NULL,
    p_social_media TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_department TEXT DEFAULT NULL,
    p_province TEXT DEFAULT NULL,
    p_district TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_orig TEXT := BTRIM(COALESCE(p_original_code, ''));
    v_new TEXT := BTRIM(COALESCE(p_new_code, ''));
BEGIN
    IF v_orig = '' THEN
        RETURN jsonb_build_object('success', false, 'message', 'El código original es obligatorio.');
    END IF;

    IF v_new = '' THEN
        RETURN jsonb_build_object('success', false, 'message', 'El nuevo código RENIPRESS es obligatorio.');
    END IF;

    -- Si el código cambió, verificar que el nuevo no exista ya
    IF v_orig <> v_new THEN
        IF EXISTS (SELECT 1 FROM public.facilities WHERE code = v_new) THEN
            RETURN jsonb_build_object('success', false, 'message', 'El código RENIPRESS "' || v_new || '" ya pertenece a otro establecimiento.');
        END IF;
    END IF;

    -- Actualizar el registro en facilities (las llaves foráneas con ON UPDATE CASCADE propagarán el cambio automáticamente)
    UPDATE public.facilities
    SET code = v_new,
        name = BTRIM(p_name),
        category = BTRIM(COALESCE(p_category, '')),
        type = p_type,
        unget_id = p_unget_id,
        microred_id = p_microred_id,
        ogess_id = p_ogess_id,
        diresa_id = p_diresa_id,
        legal_address = p_legal_address,
        website = p_website,
        social_media = p_social_media,
        phone = p_phone,
        email = p_email,
        department = p_department,
        province = p_province,
        district = p_district
    WHERE code = v_orig;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'No se encontró el establecimiento con código ' || v_orig);
    END IF;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

NOTIFY pgrst, 'reload schema';
