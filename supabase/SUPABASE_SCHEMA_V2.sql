-- Nuevas tablas para el Organigrama Extendido

-- 1. DIRESA
CREATE TABLE IF NOT EXISTS public.diresas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    ruc TEXT,
    department TEXT,
    province TEXT,
    district TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. OGESS (Unidad Ejecutora / Operativa)
CREATE TABLE IF NOT EXISTS public.ogess (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diresa_id UUID REFERENCES public.diresas(id) ON DELETE CASCADE,
    code TEXT,
    name TEXT NOT NULL,
    ruc TEXT,
    department TEXT,
    province TEXT,
    district TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Modificar UNGETs (Añadir relaciones si es necesario alterarlas)
-- Debido a que 'ungets' ya existe, le agregaremos las columnas si no existen
-- Pero para no tener problemas, es mejor recrearla o alterarla
ALTER TABLE public.ungets ADD COLUMN IF NOT EXISTS diresa_id UUID REFERENCES public.diresas(id) ON DELETE CASCADE;
ALTER TABLE public.ungets ADD COLUMN IF NOT EXISTS ogess_id UUID REFERENCES public.ogess(id) ON DELETE CASCADE;
ALTER TABLE public.ungets ADD COLUMN IF NOT EXISTS location TEXT;

-- 4. MICRORED
CREATE TABLE IF NOT EXISTS public.microredes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unget_id UUID REFERENCES public.ungets(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Modificar IPRESS / Establecimientos (Facilities)
ALTER TABLE public.facilities ADD COLUMN IF NOT EXISTS type TEXT; -- (puesto, centro, hospital, alm)
ALTER TABLE public.facilities ADD COLUMN IF NOT EXISTS microred_id UUID REFERENCES public.microredes(id) ON DELETE SET NULL;
ALTER TABLE public.facilities ADD COLUMN IF NOT EXISTS diresa_id UUID REFERENCES public.diresas(id) ON DELETE SET NULL;
ALTER TABLE public.facilities ADD COLUMN IF NOT EXISTS ogess_id UUID REFERENCES public.ogess(id) ON DELETE SET NULL;

-- 6. Modificar Personal (Para vincular a un nivel superior si no pertenecen a un Establecimiento fijo)
ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS diresa_id UUID REFERENCES public.diresas(id) ON DELETE SET NULL;
ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS ogess_id UUID REFERENCES public.ogess(id) ON DELETE SET NULL;
ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS unget_id UUID REFERENCES public.ungets(id) ON DELETE SET NULL;

-- Habilitar RLS para las nuevas tablas
ALTER TABLE public.diresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ogess ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.microredes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir todo temporalmente diresas" ON public.diresas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo temporalmente ogess" ON public.ogess FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo temporalmente microredes" ON public.microredes FOR ALL USING (true) WITH CHECK (true);

-- Notificar a Postgrest
NOTIFY pgrst, 'reload schema';
