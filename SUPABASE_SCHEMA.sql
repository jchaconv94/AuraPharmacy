-- Ejecutar en Supabase SQL Editor
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.personnel CASCADE;
DROP TABLE IF EXISTS public.facilities CASCADE;
DROP TABLE IF EXISTS public.ungets CASCADE;
DROP TABLE IF EXISTS public.roles_config CASCADE;
DROP TABLE IF EXISTS public.system_config CASCADE;

DROP TABLE IF EXISTS public.unget_configs CASCADE;

-- 1. Configuraciones de Roles
CREATE TABLE public.roles_config (
    role TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    allowed_modules JSONB DEFAULT '[]'::jsonb,
    max_urls_allowed INTEGER DEFAULT 0
);

-- 2. UNGETs (Unidades de Gestión)
CREATE TABLE public.ungets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    region TEXT DEFAULT 'San Martin'
);

-- 3. IPRESS / Establecimientos
CREATE TABLE public.facilities (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    unget_id UUID REFERENCES public.ungets(id) ON DELETE SET NULL
);

-- 4. Personal
CREATE TABLE public.personnel (
    id TEXT PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    dni TEXT,
    phone TEXT,
    email TEXT,
    facility_code TEXT REFERENCES public.facilities(code) ON DELETE SET NULL
);

-- 5. Usuarios
CREATE TABLE public.users (
    username TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    role TEXT REFERENCES public.roles_config(role) ON DELETE SET NULL,
    personnel_id TEXT REFERENCES public.personnel(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Configuración General del Sistema
CREATE TABLE public.system_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL
);

-- 7. Configuración de UNGETs (URLs de Sheets)
CREATE TABLE public.unget_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT REFERENCES public.users(username) ON DELETE CASCADE,
    unget_name TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Configurar RLS (Row Level Security) - Por ahora permitimos todo para facilitar transición
ALTER TABLE public.roles_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ungets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unget_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir todo temporalmente roles" ON public.roles_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo temporalmente ungets" ON public.ungets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo temporalmente facilities" ON public.facilities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo temporalmente personnel" ON public.personnel FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo temporalmente users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo temporalmente sysconfig" ON public.system_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo temporalmente unget_configs" ON public.unget_configs FOR ALL USING (true) WITH CHECK (true);

-- Recargar el schema de Supabase para que las APIs estén listas al instante
NOTIFY pgrst, 'reload schema';
