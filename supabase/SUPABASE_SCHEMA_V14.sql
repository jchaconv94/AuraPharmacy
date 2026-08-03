-- SUPABASE_SCHEMA_V14.sql

-- 1. facility_warehouses
CREATE TABLE IF NOT EXISTS public.facility_warehouses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    facility_code TEXT NOT NULL REFERENCES public.facilities(code) ON DELETE CASCADE,
    almcod TEXT UNIQUE NOT NULL,
    name TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. sync_installations
CREATE TABLE IF NOT EXISTS public.sync_installations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    token_hash TEXT UNIQUE NOT NULL,
    facility_code TEXT NOT NULL REFERENCES public.facilities(code) ON DELETE CASCADE,
    allowed_almcods TEXT[],
    pc_name TEXT,
    sismed_path TEXT,
    toolkit_version TEXT,
    is_active BOOLEAN DEFAULT true,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. sync_runs
CREATE TABLE IF NOT EXISTS public.sync_runs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    installation_id UUID NOT NULL REFERENCES public.sync_installations(id) ON DELETE CASCADE,
    facility_code TEXT,
    mode TEXT,
    record_count INTEGER,
    fecha_equipo TEXT,
    started_at TIMESTAMPTZ DEFAULT now(),
    finished_at TIMESTAMPTZ,
    status TEXT,
    error_message TEXT
);

-- 4. stock_actual
CREATE TABLE IF NOT EXISTS public.stock_actual (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    facility_code TEXT NOT NULL REFERENCES public.facilities(code) ON DELETE CASCADE,
    almcod TEXT NOT NULL,
    desc_alm TEXT,
    medcod TEXT NOT NULL,
    codigo_sig TEXT,
    xnom TEXT,
    lote TEXT NOT NULL,
    fecha TEXT,
    medregsan TEXT,
    tipsum TEXT,
    tipsum_des TEXT,
    ffinan TEXT,
    ffinan_des TEXT,
    saldo NUMERIC,
    precio_det NUMERIC,
    preciocab NUMERIC,
    fecha_equipo TEXT,
    ultima_actualizacion TIMESTAMPTZ DEFAULT now()
);

-- Crear indice unico para reemplazo
CREATE UNIQUE INDEX IF NOT EXISTS stock_actual_unique_idx ON public.stock_actual (facility_code, almcod, medcod, lote, fecha, ffinan, tipsum);

-- Crear indices utiles para consultas
CREATE INDEX IF NOT EXISTS stock_actual_facility_code_idx ON public.stock_actual (facility_code);
CREATE INDEX IF NOT EXISTS stock_actual_almcod_idx ON public.stock_actual (almcod);
CREATE INDEX IF NOT EXISTS stock_actual_medcod_idx ON public.stock_actual (medcod);
CREATE INDEX IF NOT EXISTS stock_actual_codigo_sig_idx ON public.stock_actual (codigo_sig);
CREATE INDEX IF NOT EXISTS stock_actual_xnom_idx ON public.stock_actual (xnom);
CREATE INDEX IF NOT EXISTS stock_actual_ultima_actualizacion_idx ON public.stock_actual (ultima_actualizacion);

-- RLS (Security)
-- Enable RLS on new tables
ALTER TABLE public.facility_warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_actual ENABLE ROW LEVEL SECURITY;

-- Note on RLS Policies: 
-- These policies are currently permissive for ease of initial development/migration.
-- In production, they must be hardened.
-- 
-- Recommended Production Policies:
-- 1. sync_installations & sync_runs:
--    - Readable by system administrators and facility supervisors.
--    - Writable ONLY by authenticated edge functions/APIs that issue the sync token.
-- 2. stock_actual & facility_warehouses:
--    - Readable by authenticated users who have permission to view the specific `facility_code`.
--    - Writable ONLY by the backend sync processes. End users should not edit this table directly.

CREATE POLICY "Permitir todo a anonimos en facility_warehouses" ON public.facility_warehouses FOR ALL USING (true);
CREATE POLICY "Permitir todo a anonimos en sync_installations" ON public.sync_installations FOR ALL USING (true);
CREATE POLICY "Permitir todo a anonimos en sync_runs" ON public.sync_runs FOR ALL USING (true);
CREATE POLICY "Permitir todo a anonimos en stock_actual" ON public.stock_actual FOR ALL USING (true);
