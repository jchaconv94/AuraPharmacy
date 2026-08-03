-- SUPABASE_SCHEMA_V9.sql
-- Tablas para Régimen Laboral y Profesiones (con CRUD dinámico)

-- 1. Tabla de Regímenes Laborales
CREATE TABLE IF NOT EXISTS public.labor_regimes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS y políticas
ALTER TABLE public.labor_regimes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo temporalmente labor_regimes" ON public.labor_regimes;
CREATE POLICY "Permitir todo temporalmente labor_regimes" ON public.labor_regimes FOR ALL USING (true) WITH CHECK (true);

-- 2. Tabla de Profesiones
CREATE TABLE IF NOT EXISTS public.professions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS y políticas
ALTER TABLE public.professions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo temporalmente professions" ON public.professions;
CREATE POLICY "Permitir todo temporalmente professions" ON public.professions FOR ALL USING (true) WITH CHECK (true);

-- 3. Agregar columnas a la tabla de personal (personnel)
ALTER TABLE public.personnel 
ADD COLUMN IF NOT EXISTS labor_regime_id TEXT REFERENCES public.labor_regimes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS profession_id TEXT REFERENCES public.professions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS phone TEXT, -- Asegurar que exista
ADD COLUMN IF NOT EXISTS email TEXT; -- Asegurar que exista

-- Insertar algunos valores iniciales por defecto en labor_regimes
INSERT INTO public.labor_regimes (id, name, description) 
VALUES 
('LR-276', 'D.L. 276', 'Sector Público - Régimen de Carrera Administrativa'),
('LR-1057', 'D.L. 1057 (CAS)', 'Contrato Administrativo de Servicios'),
('LR-1153', 'D.L. 1153', 'Régimen de Personal de la Salud'),
('LR-728', 'D.L. 728', 'Régimen de la Actividad Privada'),
('LR-LOC', 'Locación de Servicios', 'Contratación de Terceros / Locadores')
ON CONFLICT (id) DO NOTHING;

-- Insertar algunos valores iniciales por defecto en professions
INSERT INTO public.professions (id, name, description) 
VALUES 
('PROF-MED', 'Médico Cirujano', 'Profesional de la medicina'),
('PROF-QFAR', 'Químico Farmacéutico', 'Planificación y dispensación de medicamentos esenciales'),
('PROF-ENF', 'Lic. Enfermería', 'Cuidado y atención primaria u hospitalaria'),
('PROF-OBST', 'Obsetra / Lic. Obstetricia', 'Atención obstétrica y salud reproductiva'),
('PROF-TECF', 'Técnico en Farmacia', 'Apoyo en almacén y servicios de farmacia'),
('PROF-TECE', 'Técnico en Enfermería', 'Apoyo asistencial general'),
('PROF-ADM', 'Administrador / Especialista', 'Soporte de gestión logística o administrativa')
ON CONFLICT (id) DO NOTHING;

-- Forzar recarga del esquema en PostgREST / Supabase
NOTIFY pgrst, 'reload schema';
