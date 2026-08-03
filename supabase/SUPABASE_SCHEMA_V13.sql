-- SUPABASE_SCHEMA_V13.sql
-- Creación de la tabla de suscripciones de usuarios para guardar las conexiones de las UNGET en la base de datos (Supabase).

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT REFERENCES public.users(username) ON DELETE CASCADE,
    subscribed_username TEXT REFERENCES public.users(username) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(username, subscribed_username)
);

-- Configurar RLS (Row Level Security)
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Crear políticas para permitir todo temporalmente, en concordancia con el resto de tablas
DROP POLICY IF EXISTS "Permitir todo temporalmente user_subscriptions" ON public.user_subscriptions;
CREATE POLICY "Permitir todo temporalmente user_subscriptions" ON public.user_subscriptions FOR ALL USING (true) WITH CHECK (true);

-- Notificar para recargar el esquema en PostgREST
NOTIFY pgrst, 'reload schema';
