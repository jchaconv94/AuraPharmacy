-- SUPABASE_SCHEMA_IMMUNIZATIONS_V1.sql
-- Base inicial para el modulo de Inmunizaciones.
-- Ejecutar en Supabase SQL Editor despues de tener creadas las tablas organizacionales actuales.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Catalogo maestro de productos de inmunizaciones
CREATE TABLE IF NOT EXISTS public.immunization_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo_sismed TEXT NOT NULL UNIQUE,
    descripcion TEXT NOT NULL,
    tipo_producto TEXT NOT NULL CHECK (tipo_producto IN ('VACUNA', 'JERINGA', 'DILUYENTE')),
    dosis_unidad NUMERIC NOT NULL DEFAULT 1 CHECK (dosis_unidad >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    observacion TEXT,
    created_by TEXT REFERENCES public.users(username) ON DELETE SET NULL,
    updated_by TEXT REFERENCES public.users(username) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS immunization_products_codigo_idx ON public.immunization_products (codigo_sismed);
CREATE INDEX IF NOT EXISTS immunization_products_tipo_idx ON public.immunization_products (tipo_producto);
CREATE INDEX IF NOT EXISTS immunization_products_active_idx ON public.immunization_products (is_active);

-- 2. Cabecera de inventario inicial por UNGET o IPRESS
CREATE TABLE IF NOT EXISTS public.immunization_initial_inventories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_type TEXT NOT NULL CHECK (owner_type IN ('UNGET', 'IPRESS')),
    unget_id UUID REFERENCES public.ungets(id) ON DELETE CASCADE,
    facility_code TEXT REFERENCES public.facilities(code) ON DELETE CASCADE,
    period TEXT NOT NULL CHECK (period ~ '^[0-9]{4}-[0-9]{2}$'),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CLOSED')),
    source_type TEXT NOT NULL DEFAULT 'MANUAL' CHECK (source_type IN ('MANUAL', 'EXCEL', 'MIXED')),
    created_by TEXT REFERENCES public.users(username) ON DELETE SET NULL,
    closed_by TEXT REFERENCES public.users(username) ON DELETE SET NULL,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT immunization_initial_inventory_owner_chk CHECK (
        (owner_type = 'UNGET' AND unget_id IS NOT NULL AND facility_code IS NULL)
        OR
        (owner_type = 'IPRESS' AND facility_code IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS immunization_initial_inventory_unique_idx
ON public.immunization_initial_inventories (owner_type, COALESCE(unget_id::text, ''), COALESCE(facility_code, ''), period);

-- 3. Detalle de inventario inicial
CREATE TABLE IF NOT EXISTS public.immunization_initial_inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_id UUID NOT NULL REFERENCES public.immunization_initial_inventories(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.immunization_products(id) ON DELETE RESTRICT,
    codigo_sismed_snapshot TEXT NOT NULL,
    excel_description_snapshot TEXT,
    lote TEXT NOT NULL,
    expiration_date DATE NOT NULL,
    quantity NUMERIC NOT NULL CHECK (quantity >= 0),
    unit_price NUMERIC NOT NULL CHECK (unit_price >= 0),
    funding_source TEXT NOT NULL,
    supply_type TEXT NOT NULL,
    observation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS immunization_initial_items_inventory_idx ON public.immunization_initial_inventory_items (inventory_id);
CREATE INDEX IF NOT EXISTS immunization_initial_items_product_idx ON public.immunization_initial_inventory_items (product_id);
CREATE INDEX IF NOT EXISTS immunization_initial_items_lote_idx ON public.immunization_initial_inventory_items (lote);

-- 4. Capas de stock disponible por lote/precio/fuente/tipo
CREATE TABLE IF NOT EXISTS public.immunization_stock_layers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_type TEXT NOT NULL CHECK (owner_type IN ('UNGET', 'IPRESS')),
    unget_id UUID REFERENCES public.ungets(id) ON DELETE CASCADE,
    facility_code TEXT REFERENCES public.facilities(code) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.immunization_products(id) ON DELETE RESTRICT,
    lote TEXT NOT NULL,
    expiration_date DATE NOT NULL,
    unit_price NUMERIC NOT NULL CHECK (unit_price >= 0),
    funding_source TEXT NOT NULL,
    supply_type TEXT NOT NULL,
    source_movement_id UUID,
    current_quantity NUMERIC NOT NULL DEFAULT 0 CHECK (current_quantity >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT immunization_stock_owner_chk CHECK (
        (owner_type = 'UNGET' AND unget_id IS NOT NULL AND facility_code IS NULL)
        OR
        (owner_type = 'IPRESS' AND facility_code IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS immunization_stock_layers_owner_idx
ON public.immunization_stock_layers (owner_type, unget_id, facility_code);
CREATE INDEX IF NOT EXISTS immunization_stock_layers_product_idx ON public.immunization_stock_layers (product_id);
CREATE INDEX IF NOT EXISTS immunization_stock_layers_expiration_idx ON public.immunization_stock_layers (expiration_date);

-- 5. Movimientos auditables de stock
CREATE TABLE IF NOT EXISTS public.immunization_stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    movement_type TEXT NOT NULL,
    owner_type TEXT NOT NULL CHECK (owner_type IN ('UNGET', 'IPRESS')),
    unget_id UUID REFERENCES public.ungets(id) ON DELETE CASCADE,
    facility_code TEXT REFERENCES public.facilities(code) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.immunization_products(id) ON DELETE RESTRICT,
    stock_layer_id UUID REFERENCES public.immunization_stock_layers(id) ON DELETE SET NULL,
    quantity_delta NUMERIC NOT NULL,
    quantity_before NUMERIC NOT NULL,
    quantity_after NUMERIC NOT NULL CHECK (quantity_after >= 0),
    period TEXT NOT NULL CHECK (period ~ '^[0-9]{4}-[0-9]{2}$'),
    reason TEXT,
    observation TEXT,
    created_by TEXT REFERENCES public.users(username) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS immunization_movements_owner_idx
ON public.immunization_stock_movements (owner_type, unget_id, facility_code);
CREATE INDEX IF NOT EXISTS immunization_movements_period_idx ON public.immunization_stock_movements (period);
CREATE INDEX IF NOT EXISTS immunization_movements_layer_idx ON public.immunization_stock_movements (stock_layer_id);

-- 6. Cabecera de reajustes
CREATE TABLE IF NOT EXISTS public.immunization_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_type TEXT NOT NULL CHECK (owner_type IN ('UNGET', 'IPRESS')),
    unget_id UUID REFERENCES public.ungets(id) ON DELETE CASCADE,
    facility_code TEXT REFERENCES public.facilities(code) ON DELETE CASCADE,
    period TEXT NOT NULL CHECK (period ~ '^[0-9]{4}-[0-9]{2}$'),
    status TEXT NOT NULL DEFAULT 'APPLIED' CHECK (status IN ('APPLIED', 'VOIDED')),
    reason TEXT NOT NULL,
    observation TEXT NOT NULL,
    created_by TEXT REFERENCES public.users(username) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT immunization_adjustments_owner_chk CHECK (
        (owner_type = 'UNGET' AND unget_id IS NOT NULL AND facility_code IS NULL)
        OR
        (owner_type = 'IPRESS' AND facility_code IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS immunization_adjustments_owner_idx
ON public.immunization_adjustments (owner_type, unget_id, facility_code);
CREATE INDEX IF NOT EXISTS immunization_adjustments_period_idx ON public.immunization_adjustments (period);

-- 7. Detalle de reajustes
CREATE TABLE IF NOT EXISTS public.immunization_adjustment_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    adjustment_id UUID NOT NULL REFERENCES public.immunization_adjustments(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.immunization_products(id) ON DELETE RESTRICT,
    stock_layer_id UUID REFERENCES public.immunization_stock_layers(id) ON DELETE SET NULL,
    lote TEXT NOT NULL,
    expiration_date DATE NOT NULL,
    system_quantity NUMERIC NOT NULL CHECK (system_quantity >= 0),
    physical_quantity NUMERIC NOT NULL CHECK (physical_quantity >= 0),
    difference_quantity NUMERIC NOT NULL,
    unit_price NUMERIC NOT NULL CHECK (unit_price >= 0),
    funding_source TEXT NOT NULL,
    supply_type TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS immunization_adjustment_items_adjustment_idx
ON public.immunization_adjustment_items (adjustment_id);

-- RLS inicial. Las politicas siguen permisivas para no romper el entorno actual.
-- La regla definitiva debe aplicarse con Supabase Auth o Edge Functions/RPC seguras.
ALTER TABLE public.immunization_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.immunization_initial_inventories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.immunization_initial_inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.immunization_stock_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.immunization_stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.immunization_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.immunization_adjustment_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir todo temporalmente immunization_products" ON public.immunization_products;
CREATE POLICY "Permitir todo temporalmente immunization_products" ON public.immunization_products FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir todo temporalmente immunization_initial_inventories" ON public.immunization_initial_inventories;
CREATE POLICY "Permitir todo temporalmente immunization_initial_inventories" ON public.immunization_initial_inventories FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir todo temporalmente immunization_initial_inventory_items" ON public.immunization_initial_inventory_items;
CREATE POLICY "Permitir todo temporalmente immunization_initial_inventory_items" ON public.immunization_initial_inventory_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir todo temporalmente immunization_stock_layers" ON public.immunization_stock_layers;
CREATE POLICY "Permitir todo temporalmente immunization_stock_layers" ON public.immunization_stock_layers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir todo temporalmente immunization_stock_movements" ON public.immunization_stock_movements;
CREATE POLICY "Permitir todo temporalmente immunization_stock_movements" ON public.immunization_stock_movements FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir todo temporalmente immunization_adjustments" ON public.immunization_adjustments;
CREATE POLICY "Permitir todo temporalmente immunization_adjustments" ON public.immunization_adjustments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir todo temporalmente immunization_adjustment_items" ON public.immunization_adjustment_items;
CREATE POLICY "Permitir todo temporalmente immunization_adjustment_items" ON public.immunization_adjustment_items FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
